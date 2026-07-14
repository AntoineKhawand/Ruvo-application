import SwiftUI
import FirebaseAuth
import FirebaseFirestore

// MARK: – Models

struct Shoe: Identifiable, Codable {
    let id: String
    var name: String
    var brand: String
    var maxKm: Double
    var currentKm: Double
    var isRetired: Bool
    var emoji: String
    var addedAt: Date

    var wearPercent: Double { min(currentKm / maxKm, 1.0) }
    var remainingKm: Double { max(maxKm - currentKm, 0) }
    var status: ShoeStatus {
        if isRetired                { return .retired }
        if wearPercent >= 0.9       { return .replace }
        if wearPercent >= 0.75      { return .warning }
        return .good
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
    @Published var brandInput = ""
    @Published var maxKmInput = "700"
    @Published var emojiInput = "👟"

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?

    init() { listen() }

    private func listen() {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        isLoading = true
        listener = db.collection("users").document(uid).collection("shoes")
            .order(by: "addedAt", descending: true)
            .addSnapshotListener { [weak self] snap, _ in
                guard let self else { return }
                self.shoes = snap?.documents.compactMap { doc in
                    guard let name = doc["name"] as? String else { return nil }
                    return Shoe(
                        id: doc.documentID,
                        name: name,
                        brand: (doc["brand"] as? String) ?? "",
                        maxKm: (doc["maxKm"] as? Double) ?? 700,
                        currentKm: (doc["currentKm"] as? Double) ?? 0,
                        isRetired: (doc["isRetired"] as? Bool) ?? false,
                        emoji: (doc["emoji"] as? String) ?? "👟",
                        addedAt: (doc["addedAt"] as? Timestamp)?.dateValue() ?? Date()
                    )
                } ?? []
                self.isLoading = false
            }
    }

    func addShoe() {
        guard let uid = Auth.auth().currentUser?.uid, !nameInput.isEmpty else { return }
        let data: [String: Any] = [
            "name": nameInput, "brand": brandInput,
            "maxKm": Double(maxKmInput) ?? 700, "currentKm": 0.0,
            "isRetired": false, "emoji": emojiInput,
            "addedAt": Timestamp(date: Date()),
        ]
        db.collection("users").document(uid).collection("shoes").addDocument(data: data)
        nameInput = ""; brandInput = ""; maxKmInput = "700"; emojiInput = "👟"
        showAddSheet = false
    }

    func retireShoe(_ id: String) {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        db.collection("users").document(uid).collection("shoes").document(id).updateData(["isRetired": true])
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
            Text("My Shoes").font(RuvoTheme.Typography.displayMedium).foregroundColor(.white)
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
                ForEach(active)  { shoe in ShoeCard(shoe: shoe, onRetire: { vm.retireShoe(shoe.id) }) }
                if !retired.isEmpty {
                    Text("Retired").font(RuvoTheme.Typography.headingSmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 8)
                    ForEach(retired) { shoe in ShoeCard(shoe: shoe, onRetire: nil) }
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
            Text("No shoes added yet").font(RuvoTheme.Typography.headingMedium).foregroundColor(.white)
            Text("Track wear on each pair so you know\nwhen to replace them.")
                .font(RuvoTheme.Typography.bodyMedium)
                .foregroundColor(RuvoTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            Button { vm.showAddSheet = true } label: {
                Text("Add First Shoe")
                    .font(RuvoTheme.Typography.labelLarge).foregroundColor(.black)
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
                    Text("Add Shoe").font(RuvoTheme.Typography.headingLarge).foregroundColor(.white)
                    // Emoji picker
                    let emojis = ["👟", "🏃", "⚡", "🔥", "💨", "🌿", "🎯"]
                    HStack(spacing: 8) {
                        ForEach(emojis, id: \.self) { e in
                            Button { vm.emojiInput = e } label: {
                                Text(e).font(.title2)
                                    .frame(width: 44, height: 44)
                                    .background(vm.emojiInput == e ? RuvoTheme.Colors.limeDim : RuvoTheme.Colors.surfaceElevated)
                                    .clipShape(Circle())
                            }
                        }
                    }
                    ruvoField("Shoe name", text: $vm.nameInput)
                    ruvoField("Brand (Nike, Adidas…)", text: $vm.brandInput)
                    ruvoField("Max km lifespan", text: $vm.maxKmInput)
                        .keyboardType(.numberPad)

                    Button { vm.addShoe() } label: {
                        Text("Add Shoe").font(RuvoTheme.Typography.labelLarge).foregroundColor(.black)
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
            Text(label).font(RuvoTheme.Typography.labelSmall).foregroundColor(RuvoTheme.Colors.textSecondary)
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
    let onRetire: (() -> Void)?

    var body: some View {
        RuvoCard(isHighlighted: shoe.status == .replace) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    Text(shoe.emoji).font(.system(size: 36))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(shoe.name).font(RuvoTheme.Typography.labelLarge).foregroundColor(.white)
                        Text(shoe.brand).font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(shoe.status.label)
                            .font(RuvoTheme.Typography.labelSmall)
                            .foregroundColor(shoe.status.color)
                        Text(String(format: "%.0f km left", shoe.remainingKm))
                            .font(RuvoTheme.Typography.bodySmall)
                            .foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                }

                VStack(spacing: 4) {
                    HStack {
                        Text(String(format: "%.0f km", shoe.currentKm))
                            .font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textSecondary)
                        Spacer()
                        Text(String(format: "%.0f km max", shoe.maxKm))
                            .font(RuvoTheme.Typography.bodySmall).foregroundColor(RuvoTheme.Colors.textTertiary)
                    }
                    ProgressView(value: shoe.wearPercent)
                        .tint(shoe.status.color)
                        .background(RuvoTheme.Colors.border)
                        .clipShape(Capsule())
                        .frame(height: 8)
                }

                if let onRetire {
                    Button("Retire this shoe", action: onRetire)
                        .font(RuvoTheme.Typography.labelSmall)
                        .foregroundColor(RuvoTheme.Colors.textTertiary)
                }
            }
            .padding(16)
        }
    }
}
