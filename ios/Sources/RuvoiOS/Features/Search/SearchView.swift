import SwiftUI
import FirebaseFirestore
import FirebaseAuth

// MARK: - Model

/// Mirrors Android's `SearchUser` data class (`SearchScreen.kt`) field for
/// field. Built from a raw `users/{uid}` document rather than the
/// `RuvoUser` Codable model, because the real Firestore shape Android's
/// Search reads (`location.country` nested map, `name`/`totalKm` aliases)
/// doesn't line up with `RuvoUser` (flat `location: String?`, no `name` or
/// `totalKm` field) -- see `SearchViewModel.mapDocument` below.
struct SearchResult: Identifiable, Equatable {
    let uid: String
    let name: String
    let totalKm: Double
    let country: String
    var isFollowing: Bool
    let isFollower: Bool

    var id: String { uid }
}

/// Same four filter tabs, same order, as Android's `FILTERS` list in
/// `SearchScreen.kt`.
enum SearchFilter: String, CaseIterable, Identifiable {
    case everyone = "Everyone"
    case following = "Following"
    case followers = "Followers"
    case nearby = "Nearby"

    var id: String { rawValue }
}

// MARK: - ViewModel

@MainActor
final class SearchViewModel: ObservableObject {
    @Published var query: String = "" {
        didSet { scheduleSearch() }
    }
    @Published var filter: SearchFilter = .everyone {
        didSet { applyFilter() }
    }
    @Published private(set) var results: [SearchResult] = []
    @Published private(set) var isSearching = false

    private let db = Firestore.firestore()
    private var myFollowing: Set<String> = []
    private var myFollowers: Set<String> = []
    private var myCountry: String = ""
    private var allResults: [SearchResult] = []
    private var debounceTask: Task<Void, Never>?
    private var didLoadOwnDoc = false

    /// Loads the signed-in user's own following/followers/location once per
    /// screen visit -- same as Android's `SearchViewModel.init` block, which
    /// reads `users/{uid}` a single time on creation rather than per
    /// keystroke.
    func start() {
        guard !didLoadOwnDoc else { return }
        didLoadOwnDoc = true
        Task {
            guard let uid = Auth.auth().currentUser?.uid else { return }
            do {
                let doc = try await db.collection("users").document(uid).getDocument()
                guard let data = doc.data() else { return }
                myFollowing = Set(data["following"] as? [String] ?? [])
                myFollowers = Set(data["followers"] as? [String] ?? [])
                // Real field is the nested `location.country` map (same as
                // Android's SearchViewModel/ProfileViewModel/LeaderboardViewModel),
                // not a top-level "country".
                myCountry = (data["location"] as? [String: Any])?["country"] as? String ?? ""
            } catch {
                print("[Search] Load own doc error: \(error)")
            }
        }
    }

    func clearQuery() {
        query = ""
    }

    func setFilter(_ f: SearchFilter) {
        filter = f
    }

    /// Debounces exactly like Android's `onQueryChange` (`SearchViewModel.kt`):
    /// cancel any pending search and wait the same 300ms before re-querying,
    /// rather than firing Firestore reads on every keystroke.
    private func scheduleSearch() {
        debounceTask?.cancel()
        debounceTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            await self?.search()
        }
    }

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else {
            allResults = []
            results = []
            return
        }
        isSearching = true
        defer { isSearching = false }
        guard let uid = Auth.auth().currentUser?.uid else { return }
        do {
            // Same Firestore-native prefix-range query as Android's
            // SearchViewModel (`.orderBy("name").startAt(q).endAt(...)`), on
            // the same "name" field written at sign-up
            // (`AuthViewModel.createUserProfile`) -- not a separate search
            // index or client-side filter of a cached list.
            //
            // Android's own `.endAt(q + "")` is a no-op string concat in
            // Kotlin (`q + "" == q`), so its range collapses to `name == q`
            // exactly -- it can never actually match a query like "ann"
            // against a stored name "Anna". That reads like a copy/paste bug
            // (the standard Firestore prefix idiom appends a high codepoint,
            // not an empty string) rather than intended behavior, so this
            // uses the real prefix-range suffix instead of reproducing it.
            let snapshot = try await db.collection("users")
                .order(by: "name")
                .start(at: [q])
                .end(at: [q + "\u{f8ff}"])
                .limit(to: 30)
                .getDocuments()

            allResults = snapshot.documents.compactMap { doc in
                guard doc.documentID != uid else { return nil }
                return Self.mapDocument(doc.documentID, doc.data(), myFollowing: myFollowing, myFollowers: myFollowers)
            }
            applyFilter()
        } catch {
            print("[Search] Query error: \(error)")
        }
    }

    private static func mapDocument(_ uid: String, _ d: [String: Any], myFollowing: Set<String>, myFollowers: Set<String>) -> SearchResult {
        let name = d["name"] as? String ?? d["displayName"] as? String ?? "Runner"
        let totalKm = (d["totalKm"] as? Double) ?? (d["totalDistanceKm"] as? Double) ?? 0
        let location = d["location"] as? [String: Any]
        let country = location?["country"] as? String ?? ""
        return SearchResult(
            uid: uid,
            name: name,
            totalKm: totalKm,
            country: country,
            isFollowing: myFollowing.contains(uid),
            isFollower: myFollowers.contains(uid)
        )
    }

    private func applyFilter() {
        switch filter {
        case .everyone:  results = allResults
        case .following: results = allResults.filter { $0.isFollowing }
        case .followers: results = allResults.filter { $0.isFollower }
        case .nearby:    results = allResults.filter { !myCountry.isEmpty && $0.country == myCountry }
        }
    }

    /// Follows/unfollows with the same batched, two-sided write every other
    /// real follow flow in this app uses -- Android's `FindFriendsViewModel`
    /// (my doc's "following" arrayUnion/Remove + their doc's "followers"
    /// arrayUnion/Remove in one batch) and what `firestore.rules` actually
    /// requires (cross-user writes may only touch the target's "followers").
    ///
    /// Deliberately does NOT mirror Android's own `SearchViewModel.toggleFollow`,
    /// which writes only to the signed-in user's own "following" array and
    /// never touches the target's "followers" -- that looks like a real bug
    /// in Android's Search feature (the target's follower list/count would
    /// never reflect a follow made from Search), not a second legitimate
    /// pattern worth preserving on iOS.
    func toggleFollow(_ targetUid: String) {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let isFollowing = myFollowing.contains(targetUid)
        let myRef = db.collection("users").document(uid)
        let targetRef = db.collection("users").document(targetUid)
        let batch = db.batch()
        if isFollowing {
            batch.updateData(["following": FieldValue.arrayRemove([targetUid])], forDocument: myRef)
            batch.updateData(["followers": FieldValue.arrayRemove([uid])], forDocument: targetRef)
            myFollowing.remove(targetUid)
        } else {
            batch.updateData(["following": FieldValue.arrayUnion([targetUid])], forDocument: myRef)
            batch.updateData(["followers": FieldValue.arrayUnion([uid])], forDocument: targetRef)
            myFollowing.insert(targetUid)
        }
        if let idx = allResults.firstIndex(where: { $0.uid == targetUid }) {
            allResults[idx].isFollowing = !isFollowing
        }
        applyFilter()
        Task {
            do { try await batch.commit() } catch {
                print("[Search] toggleFollow error: \(error)")
            }
        }
    }
}

// MARK: - View

struct SearchView: View {
    @EnvironmentObject private var router: NavigationRouter
    @StateObject private var viewModel = SearchViewModel()

    var body: some View {
        VStack(spacing: 0) {
            searchField
                .padding(.horizontal, RuvoTheme.Spacing.md)
                .padding(.top, RuvoTheme.Spacing.sm)

            filterChips
                .padding(.top, RuvoTheme.Spacing.sm)

            content
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("Search")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { viewModel.start() }
    }

    private var searchField: some View {
        HStack(spacing: RuvoTheme.Spacing.sm) {
            RuvoTextField(
                placeholder: "Search runners…",
                text: $viewModel.query,
                icon: "magnifyingglass"
            )
            if !viewModel.query.isEmpty {
                Button(action: viewModel.clearQuery) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
                .transition(.opacity)
            }
        }
        .animation(RuvoTheme.Motion.easeInOut(RuvoTheme.Motion.Duration.quick), value: viewModel.query.isEmpty)
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                ForEach(SearchFilter.allCases) { f in
                    RuvoSelectionChip(
                        label: f.rawValue,
                        isSelected: viewModel.filter == f,
                        shape: AnyShape(Capsule()),
                        action: { viewModel.setFilter(f) }
                    )
                    .frame(width: 92, height: 36)
                }
            }
            .padding(.horizontal, RuvoTheme.Spacing.md)
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isSearching {
            Spacer()
            ProgressView().tint(RuvoTheme.Colors.primary)
            Spacer()
        } else if viewModel.query.trimmingCharacters(in: .whitespaces).isEmpty {
            emptyState(
                icon: "magnifyingglass",
                title: "Search for runners",
                subtitle: "Find friends, training partners, and rivals"
            )
        } else if viewModel.results.isEmpty {
            emptyState(
                icon: "questionmark.circle",
                title: "No runners found for \u{201C}\(viewModel.query)\u{201D}",
                subtitle: nil
            )
        } else {
            ScrollView {
                LazyVStack(spacing: RuvoTheme.Spacing.sm) {
                    ForEach(viewModel.results) { result in
                        SearchResultRow(
                            result: result,
                            onTap: { router.navigate(to: .profile(userId: result.uid)) },
                            onToggleFollow: { viewModel.toggleFollow(result.uid) }
                        )
                    }
                }
                .padding(RuvoTheme.Spacing.md)
                .padding(.bottom, RuvoTheme.Spacing.xxl)
            }
        }
    }

    private func emptyState(icon: String, title: String, subtitle: String?) -> some View {
        VStack {
            Spacer()
            VStack(spacing: RuvoTheme.Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 44))
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
                Text(title)
                    .font(RuvoTheme.Typography.headingSmall)
                    .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                    .foregroundColor(RuvoTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                if let subtitle {
                    Text(subtitle)
                        .font(RuvoTheme.Typography.bodyMedium)
                        .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, RuvoTheme.Spacing.xl)
            Spacer()
        }
    }
}

struct SearchResultRow: View {
    let result: SearchResult
    let onTap: () -> Void
    let onToggleFollow: () -> Void

    var body: some View {
        RuvoCard {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                Button(action: onTap) {
                    ZStack {
                        Circle()
                            .fill(RuvoTheme.Colors.surfaceElevated)
                            .overlay(Circle().stroke(RuvoTheme.Colors.border, lineWidth: 1.5))
                        Image(systemName: "person.fill")
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                    .frame(width: 46, height: 46)
                }
                .buttonStyle(.plain)

                Button(action: onTap) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(result.name)
                            .font(RuvoTheme.Typography.labelLarge)
                            .tracking(RuvoTheme.Typography.Tracking.labelLarge)
                            .foregroundColor(RuvoTheme.Colors.textPrimary)
                        Text(subtitle)
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                RuvoButton(
                    title: result.isFollowing ? "Following" : "Follow",
                    style: result.isFollowing ? .secondary : .primary,
                    isFullWidth: false,
                    action: onToggleFollow
                )
            }
            .padding(RuvoTheme.Spacing.sm)
        }
    }

    private var subtitle: String {
        let km = String(format: "%.0f km", result.totalKm)
        return result.country.isEmpty ? km : "\(km) \u{00B7} \(result.country)"
    }
}
