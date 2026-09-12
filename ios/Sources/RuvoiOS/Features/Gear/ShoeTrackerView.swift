import SwiftUI
import FirebaseAuth
import FirebaseFirestore

// MARK: – Models
//
// Data-model migration note: this used to read/write a `users/{uid}/shoes`
// subcollection (iOS-only, non-standard shape). That has been replaced with
// Android's real shape -- the `gearList` array field stored directly on the
// `users/{uid}` document (see
// android/app/src/main/java/com/ruvo/app/features/gear/ShoeTrackerScreen.kt,
// whose `Shoe` data class + `toMap()` define the exact wire shape:
// `id`, `name`, `limit`, `distance`, `isDefault`). Standardizing on Android's
// shape was an engineering call made in this pass, not a pre-existing
// decision -- see the PR/report for the reasoning and the now-unused
// `users/{uid}/shoes` firestore.rules entry that should be removed separately.
//
// Two real deviations from a pure field-rename, called out explicitly:
//   1. Android's model has NO `brand`, `emoji`, or `addedAt` fields at all --
//      they were invented by iOS's old subcollection shape and have nothing
//      to round-trip to/from. Rather than keep them as fields that silently
//      reset every relaunch (never actually persisted), they've been dropped
//      from the model and the UI. `isDefault` (which iOS never had) has been
//      added since it's a real, persisted field on Android's shoe entries.
//   2. Android has NO stored `isRetired` flag -- it's a computed property
//      (`distance >= limit`) on both platforms now. iOS previously had a
//      manual "Retire this shoe" action that set an explicit flag; since
//      that flag no longer exists, "retiring" a shoe here means pinning its
//      `distance` to its `limit` (the same signal Android already treats as
//      retirement), not writing a field Android's schema doesn't have.
struct Shoe: Identifiable, Codable {
    let id: String
    var name: String
    var limit: Double
    var distance: Double
    var isDefault: Bool

    var wearPercent: Double { limit <= 0 ? 0 : min(distance / limit, 1.0) }
    var remainingKm: Double { max(limit - distance, 0) }
    var isRetired: Bool { distance >= limit }
    var status: ShoeStatus {
        if isRetired                { return .retired }
        if wearPercent >= 0.9       { return .replace }
        if wearPercent >= 0.75      { return .warning }
        return .good
    }

    func toDict() -> [String: Any] {
        ["id": id, "name": name, "limit": limit, "distance": distance, "isDefault": isDefault]
    }
}

enum ShoeStatus {
    case good, warning, replace, retired
    var label: String {
        switch self { case .good: "Good"; case .warning: "Getting worn"; case .replace: "Replace soon"; case .retired: "Retired" }
    }
    var color: Color {
        switch self { case .good: .green; case .warning: .orange; case .replace: .red; case .retired: Color.gray.opacity(0.6) }
    }
}

// MARK: – ViewModel

@MainActor
final class ShoeTrackerViewModel: ObservableObject {
    @Published var shoes: [Shoe] = []
    @Published var isLoading = false
    @Published var showAddSheet = false

    @Published var nameInput  = ""
    @Published var maxKmInput = "700"

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?

    init() { listen() }

    private func listen() {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        isLoading = true
        // Same document Android listens to -- users/{uid}.gearList -- not a
        // subcollection, so this is a single-document listener, not a query.
        listener = db.collection("users").document(uid)
            .addSnapshotListener { [weak self] snap, _ in
                guard let self else { return }
                let rawList = snap?.get("gearList") as? [[String: Any]] ?? []
                self.shoes = rawList.compactMap { entry -> Shoe? in
                    guard let id = entry["id"] as? String else { return nil }
                    return Shoe(
                        id: id,
                        name: entry["name"] as? String ?? "",
                        limit: (entry["limit"] as? NSNumber)?.doubleValue ?? 800,
                        distance: (entry["distance"] as? NSNumber)?.doubleValue ?? 0,
                        isDefault: entry["isDefault"] as? Bool ?? false
                    )
                }
                self.isLoading = false
            }
    }

    // Whole-array replace, matching Android's addShoe/updateShoe/deleteShoe
    // (all of which re-serialize the full list and `update("gearList", ...)`
    // rather than doing a per-item arrayUnion/arrayRemove) -- keeps the write
    // pattern identical across platforms.
    private func writeGearList(_ newShoes: [Shoe]) {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        db.collection("users").document(uid)
            .updateData(["gearList": newShoes.map { $0.toDict() }])
    }

    func addShoe() {
        guard !nameInput.isEmpty else { return }
        let newShoe = Shoe(
            id: UUID().uuidString,
            name: nameInput,
            limit: Double(maxKmInput) ?? 700,
            distance: 0,
            isDefault: shoes.isEmpty // first shoe added becomes the active one, as on Android
        )
        writeGearList(shoes + [newShoe])
        nameInput = ""
        maxKmInput = "700"
        showAddSheet = false
    }

    func retireShoe(_ id: String) {
        let updated = shoes.map { shoe -> Shoe in
            guard shoe.id == id else { return shoe }
            var retired = shoe
            retired.distance = shoe.limit
            return retired
        }
        writeGearList(updated)
    }

    func setActive(_ id: String) {
        let updated = shoes.map { shoe -> Shoe in
            var updated = shoe
            updated.isDefault = (shoe.id == id)
            return updated
        }
        writeGearList(updated)
    }

    func deleteShoe(_ id: String) {
        writeGearList(shoes.filter { $0.id != id })
    }

    deinit { listener?.remove() }
}

// MARK: – Root View

struct ShoeTrackerView: View {
    @StateObject private var vm = ShoeTrackerViewModel()

    var body: some View {
        ZStack {
            RuvoTheme.Colors.background.ignoresSafeArea()
            VStack(spacing: 0) {
                headerRow
                if vm.isLoading {
                    ProgressView().tint(RuvoTheme.Colors.primary).padding()
                } else if vm.shoes.isEmpty {
                    emptyState
                } else {
                    shoeList
                }
            }
        }
        .sheet(isPresented: $vm.showAddSheet) { addShoeSheet }
    }

    // MARK: Header
    private var headerRow: some View {
        HStack {
            Text("My Shoes").font(RuvoTheme.Typography.displayMedium).tracking(RuvoTheme.Typography.Tracking.displayMedium).foregroundColor(.white)
            Spacer()
            Button { vm.showAddSheet = true } label: {
                Image(systemName: "plus.circle.fill")
                    .foregroundColor(RuvoTheme.Colors.primary)
                    .font(.title2)
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 16)
    }

    // MARK: Shoe List
    private var shoeList: some View {
        ScrollView {
            VStack(spacing: 12) {
                let active  = vm.shoes.filter { !$0.isRetired }
                let retired = vm.shoes.filter { $0.isRetired }
                ForEach(active) { shoe in
                    ShoeCard(
                        shoe: shoe,
                        onSetActive: shoe.isDefault ? nil : { vm.setActive(shoe.id) },
                        onRetire: { vm.retireShoe(shoe.id) },
                        onDelete: { vm.deleteShoe(shoe.id) }
                    )
                }
                if !retired.isEmpty {
                    Text("Retired").font(RuvoTheme.Typography.headingSmall)
                        .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 8)
                    ForEach(retired) { shoe in
                        ShoeCard(shoe: shoe, onSetActive: nil, onRetire: nil, onDelete: { vm.deleteShoe(shoe.id) })
                    }
                }
                Spacer(minLength: 80)
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: Empty State
    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("👟").font(.system(size: 64))
            Text("No shoes added yet").font(RuvoTheme.Typography.headingMedium).tracking(RuvoTheme.Typography.Tracking.headingMedium).foregroundColor(.white)
            Text("Track wear on each pair so you know\nwhen to replace them.")
                .font(RuvoTheme.Typography.bodyMedium)
                .tracking(RuvoTheme.Typography.Tracking.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            Button { vm.showAddSheet = true } label: {
                Text("Add First Shoe")
                    .font(RuvoTheme.Typography.labelLarge).tracking(RuvoTheme.Typography.Tracking.labelLarge).foregroundColor(.black)
                    .frame(height: 52).frame(maxWidth: .infinity)
                    .background(RuvoTheme.Colors.primary)
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 40)
            Spacer()
        }
        .padding()
    }

    // MARK: Add Sheet
    private var addShoeSheet: some View {
        ZStack { RuvoTheme.Colors.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Add Shoe").font(RuvoTheme.Typography.headingLarge).tracking(RuvoTheme.Typography.Tracking.headingLarge).foregroundColor(.white)
                    ruvoField("Shoe name", text: $vm.nameInput)
                    ruvoField("Max km lifespan", text: $vm.maxKmInput)
                        .keyboardType(.numberPad)

                    Button { vm.addShoe() } label: {
                        Text("Add Shoe").font(RuvoTheme.Typography.labelLarge).tracking(RuvoTheme.Typography.Tracking.labelLarge).foregroundColor(.black)
                            .frame(maxWidth: .infinity).frame(height: 52)
                            .background(vm.nameInput.isEmpty ? Color.gray : RuvoTheme.Colors.primary)
                            .clipShape(Capsule())
                    }
                    .disabled(vm.nameInput.isEmpty)
                }
                .padding(20)
            }
        }
    }

    private func ruvoField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(RuvoTheme.Typography.labelSmall).tracking(RuvoTheme.Typography.Tracking.labelSmall).foregroundColor(RuvoTheme.Colors.textSecondary)
            TextField("", text: text)
                .foregroundColor(.white)
                .padding(14)
                .background(RuvoTheme.Colors.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(RuvoTheme.Colors.border, lineWidth: 1))
        }
    }
}

// MARK: – ShoeCard

private struct ShoeCard: View {
    let shoe: Shoe
    let onSetActive: (() -> Void)?
    let onRetire: (() -> Void)?
    let onDelete: (() -> Void)?

    var body: some View {
        RuvoCard(isHighlighted: shoe.status == .replace || shoe.isDefault) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    Text("👟").font(.system(size: 36))
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(shoe.name).font(RuvoTheme.Typography.labelLarge).tracking(RuvoTheme.Typography.Tracking.labelLarge).foregroundColor(.white)
                            if shoe.isDefault {
                                Text("ACTIVE")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(.black)
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(RuvoTheme.Colors.primary)
                                    .clipShape(Capsule())
                            }
                        }
                        Text("\(Int(shoe.limit)) km lifespan")
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(shoe.status.label)
                            .font(RuvoTheme.Typography.labelSmall)
                            .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                            .foregroundColor(shoe.status.color)
                        Text(String(format: "%.0f km left", shoe.remainingKm))
                            .font(RuvoTheme.Typography.bodySmall)
                            .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                }

                VStack(spacing: 4) {
                    HStack {
                        Text(String(format: "%.0f km", shoe.distance))
                            .font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                        Spacer()
                        Text(String(format: "%.0f km max", shoe.limit))
                            .font(RuvoTheme.Typography.bodySmall).tracking(RuvoTheme.Typography.Tracking.bodySmall).foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                    ProgressView(value: shoe.wearPercent)
                        .tint(shoe.status.color)
                        .background(RuvoTheme.Colors.border)
                        .clipShape(Capsule())
                        .frame(height: 8)
                }

                if onSetActive != nil || onRetire != nil || onDelete != nil {
                    HStack(spacing: 16) {
                        if let onSetActive {
                            Button("Set active", action: onSetActive)
                                .font(RuvoTheme.Typography.labelSmall)
                                .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                                .foregroundColor(RuvoTheme.Colors.primary)
                        }
                        if let onRetire {
                            Button("Retire this shoe", action: onRetire)
                                .font(RuvoTheme.Typography.labelSmall)
                                .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                                .foregroundColor(RuvoTheme.Colors.textTertiary)
                        }
                        Spacer()
                        if let onDelete {
                            Button("Delete", action: onDelete)
                                .font(RuvoTheme.Typography.labelSmall)
                                .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                                .foregroundColor(.red.opacity(0.8))
                        }
                    }
                }
            }
            .padding(16)
        }
    }
}
