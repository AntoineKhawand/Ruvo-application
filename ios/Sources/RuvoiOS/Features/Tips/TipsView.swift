import SwiftUI

// MARK: – Model

/// Mirrors Android's `TipStep` (`core/model/Models.kt`) field for field.
struct TipStep: Identifiable, Hashable {
    let title: String
    let desc: String
    var id: String { title }
}

/// Mirrors Android's `Tip` data class (`core/model/Models.kt`) field for
/// field. `viewCount` is `Long` on Android; `Int` is plenty here (the
/// largest seeded value is well under 20,000).
struct Tip: Identifiable, Hashable {
    let id: String
    let category: String
    let tag: String
    let title: String
    let readTime: Int
    let desc: String
    let img: String
    let why: String
    let keyTakeaway: String
    let steps: [TipStep]
    let viewCount: Int
}

/// Verbatim port of Android's `TipsLibrary.ALL` (`core/content/TipsLibrary.kt`).
/// That file's own comment is the reason this is a static Swift catalog and
/// not a Firestore fetch: "Tip content is the source of truth here (mirrors
/// the RN reference app's FALLBACK_TIPS) — Firestore's 'content' collection
/// only stores live view counts, refreshed in the background by
/// ContentRepository.seedTipsToFirestore()." New tips ship in code on every
/// platform; nothing here needs a Firestore migration to appear.
enum TipsLibrary {
    static let all: [Tip] = [
        // ── TECHNIQUE ────────────────────────────────────────────
        Tip(
            id: "1", category: "Technique", tag: "TECHNIQUE",
            title: "Trail Running", readTime: 3,
            desc: "Build ankle strength and stability on uneven terrain.",
            img: "https://images.pexels.com/photos/1571939/pexels-photo-1571939.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Uneven terrain forces stabilising muscles that road running ignores. Research shows trail runners have 25% fewer overuse injuries than road runners, because the body constantly adapts to micro-variations in the ground.",
            keyTakeaway: "Shorten your stride by 10% and lift your feet slightly higher — this alone reduces ankle rolls by half.",
            steps: [
                TipStep(title: "Scout the Route", desc: "Check elevation maps and trail conditions before heading out."),
                TipStep(title: "Shorten Your Stride", desc: "Keep feet under your hips to react quickly to roots and rocks."),
                TipStep(title: "Scan 10 Feet Ahead", desc: "Look ahead, not at your feet. Your peripheral vision handles foot placement."),
            ],
            viewCount: 12500
        ),
        Tip(
            id: "2", category: "Technique", tag: "TECHNIQUE",
            title: "Cadence Drills", readTime: 3,
            desc: "Improve efficiency by training your step rate to 180 spm.",
            img: "https://images.pexels.com/photos/4048182/pexels-photo-4048182.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Elite runners average 180 steps per minute. A higher cadence reduces ground contact time, lowering impact force on joints by up to 30%. Even a 5% increase in cadence can reduce knee stress significantly.",
            keyTakeaway: "Use a metronome app set to 180 bpm for one song per run until the rhythm becomes automatic.",
            steps: [
                TipStep(title: "Count Your Steps", desc: "Count every right-foot strike for 30 seconds. Multiply by 4."),
                TipStep(title: "Use a Metronome", desc: "Set it to 170–180 bpm and match each beat to a foot strike."),
                TipStep(title: "Shorten, Don't Speed", desc: "Increase cadence by taking quicker, shorter steps — not running faster."),
            ],
            viewCount: 9800
        ),
        Tip(
            id: "3", category: "Technique", tag: "TECHNIQUE",
            title: "Hill Repeats", readTime: 4,
            desc: "Build explosive leg power with structured uphill training.",
            img: "https://images.pexels.com/photos/1563277/pexels-photo-1563277.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Running uphill activates the glutes and hamstrings 30–40% more than flat running. Hill repeats build strength, improve VO2 max, and teach efficient form — all without the joint impact of track speed work.",
            keyTakeaway: "Drive your arms aggressively on uphills — your legs follow your arms.",
            steps: [
                TipStep(title: "Warm Up Flat", desc: "10 minutes easy running before any hill work."),
                TipStep(title: "Sprint Up", desc: "Run hard uphill for 20–60 seconds, leaning slightly forward."),
                TipStep(title: "Walk Down", desc: "Use the descent as full recovery — never sprint downhill in training."),
            ],
            viewCount: 11800
        ),
        Tip(
            id: "4", category: "Technique", tag: "TECHNIQUE",
            title: "Breathing Form", readTime: 3,
            desc: "Sync your breath to your stride to eliminate side stitches.",
            img: "https://images.pexels.com/photos/3621183/pexels-photo-3621183.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Most runners breathe shallowly from the chest. Diaphragmatic breathing delivers 40% more oxygen per breath and prevents the diaphragm cramp that causes side stitches.",
            keyTakeaway: "A 3:2 breathing ratio (inhale for 3 steps, exhale for 2) distributes foot strikes across both sides, reducing injury risk.",
            steps: [
                TipStep(title: "Belly Breathe", desc: "Place a hand on your stomach — it should rise on the inhale, not your chest."),
                TipStep(title: "Try 3:2 Rhythm", desc: "Inhale for 3 footfalls, exhale for 2. Practice walking before running."),
                TipStep(title: "Exhale Fully", desc: "Force every bit of air out. A complete exhale creates a deeper inhale automatically."),
            ],
            viewCount: 8400
        ),
        Tip(
            id: "5", category: "Technique", tag: "TECHNIQUE",
            title: "Running Posture", readTime: 3,
            desc: "A slight forward lean unlocks free speed and reduces fatigue.",
            img: "https://images.pexels.com/photos/1199590/pexels-photo-1199590.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Poor posture wastes energy on every single stride. Studies show optimal running posture improves economy by up to 8%, meaning you run faster on the same effort.",
            keyTakeaway: "Imagine a string pulling the top of your head toward the sky. This single cue corrects 80% of posture errors.",
            steps: [
                TipStep(title: "Tall Spine", desc: "Ears over shoulders, shoulders over hips. Maintain this while running."),
                TipStep(title: "Forward Lean", desc: "Lean 5° forward from the ankles (not the waist). Use gravity to propel you."),
                TipStep(title: "Arms at 90°", desc: "Keep elbows bent at 90°. Swing forward-back, never across your body."),
            ],
            viewCount: 7200
        ),

        // ── NUTRITION ────────────────────────────────────────────
        Tip(
            id: "6", category: "Nutrition", tag: "NUTRITION",
            title: "Pre-Run Fuel", readTime: 3,
            desc: "Time your carbs correctly and never hit the wall again.",
            img: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Timing carbohydrates is as important as quantity. Eating complex carbs 2–3 hours before a run maximises glycogen stores. A small fast-digesting snack 30–45 minutes before tops up blood glucose without causing GI distress.",
            keyTakeaway: "A ripe banana with a tablespoon of peanut butter 45 minutes before running is nearly perfect sports nutrition.",
            steps: [
                TipStep(title: "3 Hours Before", desc: "Eat a mixed meal: oats, rice, or pasta with some protein."),
                TipStep(title: "45 Min Before", desc: "Small fast-carb snack: banana, toast, or a sports gel."),
                TipStep(title: "Avoid Fat & Fibre", desc: "High-fat and high-fibre foods close to a run cause GI issues mid-stride."),
            ],
            viewCount: 15300
        ),
        Tip(
            id: "7", category: "Nutrition", tag: "NUTRITION",
            title: "Hydration Hacks", readTime: 3,
            desc: "Stay perfectly hydrated without the sloshing mid-run.",
            img: "https://images.pexels.com/photos/4379227/pexels-photo-4379227.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Even 2% dehydration reduces running performance by up to 10%. But over-hydrating is equally dangerous. The goal is pre-loading smartly and sipping during, not gulping at once.",
            keyTakeaway: "Check your urine before heading out. Pale yellow = good. Dark yellow = drink 500ml before you leave.",
            steps: [
                TipStep(title: "Pre-Load Smart", desc: "Drink 500ml of water 2 hours before, not right before the run."),
                TipStep(title: "Sip, Don't Gulp", desc: "Take small sips every 15–20 minutes. Large amounts cause sloshing and nausea."),
                TipStep(title: "Add Electrolytes", desc: "For runs over 60 min, add sodium to prevent hyponatremia."),
            ],
            viewCount: 14200
        ),
        Tip(
            id: "8", category: "Nutrition", tag: "NUTRITION",
            title: "Recovery Meal", readTime: 3,
            desc: "The 30-minute window that determines tomorrow's performance.",
            img: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Muscle protein synthesis peaks 30–60 minutes after a run. Consuming 20–30g of protein in this window accelerates muscle repair and reduces DOMS by up to 40%.",
            keyTakeaway: "A 4:1 carb-to-protein ratio immediately after hard runs is the scientifically optimal recovery ratio.",
            steps: [
                TipStep(title: "Within 30 Min", desc: "Consume 20–30g protein + 60–80g carbohydrates immediately after."),
                TipStep(title: "Chocolate Milk", desc: "This natural drink has nearly the perfect 4:1 carb-to-protein ratio."),
                TipStep(title: "Anti-Inflammatory Foods", desc: "Add berries, turmeric, or tart cherry juice to reduce muscle inflammation."),
            ],
            viewCount: 10900
        ),
        Tip(
            id: "9", category: "Nutrition", tag: "NUTRITION",
            title: "Race Day Nutrition", readTime: 4,
            desc: "What and when to eat to peak on race morning.",
            img: "https://images.pexels.com/photos/3622614/pexels-photo-3622614.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Race nerves suppress appetite but muscles still need fuel. Studies of marathon runners show those who eat a proper pre-race breakfast finish 8 minutes faster on average.",
            keyTakeaway: "Never try new foods or gels on race morning. Stick to exactly what you practiced in training.",
            steps: [
                TipStep(title: "3 Hours Before Gun", desc: "Familiar carb-based breakfast: oatmeal, bagel, or white rice."),
                TipStep(title: "60 Min Before", desc: "One energy gel or banana + 400ml of water."),
                TipStep(title: "During the Race", desc: "Take gels at miles 5, 10, 18 for a marathon. Always with water, never sports drink."),
            ],
            viewCount: 13400
        ),

        // ── RECOVERY ─────────────────────────────────────────────
        Tip(
            id: "10", category: "Recovery", tag: "RECOVERY",
            title: "Recovery Yoga", readTime: 4,
            desc: "Unlock tight hips and hamstrings after hard runs.",
            img: "https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Static stretching after a run helps realign muscle fibres and flush metabolic waste. Post-run yoga reduces delayed-onset muscle soreness by 30% and improves flexibility over time.",
            keyTakeaway: "Hold each pose for at least 60 seconds. Shorter holds provide no measurable flexibility benefit.",
            steps: [
                TipStep(title: "Downward Dog", desc: "Hold 60 seconds to decompress the spine and stretch calves."),
                TipStep(title: "Pigeon Pose", desc: "Open up hip flexors. Hold 90 seconds each side."),
                TipStep(title: "Deep Belly Breathing", desc: "In each pose, exhale fully and deepen the stretch at the bottom of each breath."),
            ],
            viewCount: 18900
        ),
        Tip(
            id: "11", category: "Recovery", tag: "RECOVERY",
            title: "Sleep Optimisation", readTime: 4,
            desc: "The single most powerful performance enhancer is free.",
            img: "https://images.pexels.com/photos/3771069/pexels-photo-3771069.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "During deep sleep, human growth hormone surges — muscles actually repair and grow. Research at Stanford showed athletes who extended sleep to 10 hours improved speed by 5% and reaction time by 15%.",
            keyTakeaway: "7–9 hours in a cool, dark room is more impactful than any supplement, stretch, or ice bath.",
            steps: [
                TipStep(title: "Cool the Room", desc: "Ideal sleep temperature is 65–68°F (18–20°C). Body temperature must drop to trigger sleep."),
                TipStep(title: "No Screens 60 Min Before", desc: "Blue light suppresses melatonin. Use night mode or read instead."),
                TipStep(title: "Consistent Wake Time", desc: "Waking at the same time daily is more important than bedtime for sleep quality."),
            ],
            viewCount: 16100
        ),
        Tip(
            id: "12", category: "Recovery", tag: "RECOVERY",
            title: "Foam Rolling", readTime: 3,
            desc: "Break up fascia knots before they become injuries.",
            img: "https://images.pexels.com/photos/4571319/pexels-photo-4571319.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Foam rolling releases myofascial tension. It improves range of motion more than static stretching in the immediate term, and reduces muscle soreness by increasing blood flow.",
            keyTakeaway: "Roll slowly and pause for 30–60 seconds on any tender point — that is exactly where you need it most.",
            steps: [
                TipStep(title: "IT Band", desc: "Roll from hip to knee slowly. Pause on tight spots — up to 60 seconds."),
                TipStep(title: "Calves", desc: "Cross one leg over the other for more pressure. Point and flex your toes."),
                TipStep(title: "Glutes", desc: "Sit on the roller, cross one ankle over the opposite knee, lean to that side."),
            ],
            viewCount: 12700
        ),
        Tip(
            id: "13", category: "Recovery", tag: "RECOVERY",
            title: "Active Recovery", readTime: 3,
            desc: "Why easy days are where your real fitness gains happen.",
            img: "https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Fitness is built during rest, not training. Active recovery flushes lactate, increases blood flow to repair tissue, and maintains aerobic conditioning without adding stress.",
            keyTakeaway: "If you can't hold a conversation, it's not a recovery run — it's just another hard day that blocks adaptation.",
            steps: [
                TipStep(title: "Easy Run", desc: "Run at 60–65% max heart rate. You should talk in full sentences."),
                TipStep(title: "Swim or Cycle", desc: "These non-impact options move blood through muscles without joint stress."),
                TipStep(title: "Walk", desc: "30 minutes of walking improves recovery more than sitting still."),
            ],
            viewCount: 9300
        ),

        // ── MENTAL ───────────────────────────────────────────────
        Tip(
            id: "14", category: "Mental", tag: "MENTAL",
            title: "Mental Toughness", readTime: 4,
            desc: "Psychological tools to keep going when legs want to quit.",
            img: "https://images.pexels.com/photos/3775603/pexels-photo-3775603.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "In long races, athletes who hit the wall often still have glycogen remaining — they have reached their psychological limit, not their physical one. Mental training can delay this perceived limit by 8–12%.",
            keyTakeaway: "Split the remaining distance into small chunks. Your brain can endure almost anything when you only commit to the next 5 minutes.",
            steps: [
                TipStep(title: "Chunk It Down", desc: "Never think about how far is left. Focus only on the next lamp post, the next mile."),
                TipStep(title: "Positive Self-Talk", desc: "Replace \"I can't\" with \"I am\" statements. \"I am strong, I am fast.\""),
                TipStep(title: "Anchor Word", desc: "Pick one word (e.g. \"power\"). Repeat it rhythmically with your stride."),
            ],
            viewCount: 10500
        ),
        Tip(
            id: "15", category: "Mental", tag: "MENTAL",
            title: "Visualisation", readTime: 3,
            desc: "How elite runners mentally rehearse every race beforehand.",
            img: "https://images.pexels.com/photos/4498482/pexels-photo-4498482.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Brain scans show that mental imagery activates the same neural pathways as physical practice. Olympic athletes spend up to 30% of training time on visualisation.",
            keyTakeaway: "Visualise in first-person, not third-person. You should feel your feet hitting the ground, not watch yourself from above.",
            steps: [
                TipStep(title: "Find Quiet Space", desc: "Sit comfortably, close your eyes. Breathe slowly for 2 minutes."),
                TipStep(title: "Run the Race", desc: "Mentally run your entire race in real time — every turn, every tough moment."),
                TipStep(title: "Add Adversity", desc: "Visualise things going wrong (bad weather, side stitch) and calmly overcoming them."),
            ],
            viewCount: 7800
        ),
        Tip(
            id: "16", category: "Mental", tag: "MENTAL",
            title: "Flow State", readTime: 3,
            desc: "Trigger the runner's high on demand.",
            img: "https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Flow state — where running feels effortless — is triggered when challenge and skill are perfectly balanced. For runners it dramatically reduces perceived effort.",
            keyTakeaway: "Phone in your pocket, eyes forward, music at moderate volume. Distraction is the enemy of flow.",
            steps: [
                TipStep(title: "Match Challenge to Skill", desc: "Pick a route that is challenging but not overwhelming for your current fitness."),
                TipStep(title: "Single Focus", desc: "Choose one thing to concentrate on — breathing, form, or a mantra."),
                TipStep(title: "Remove Distractions", desc: "Leave the notifications off. Check your watch maximum once per mile."),
            ],
            viewCount: 8900
        ),

        // ── STRENGTH ─────────────────────────────────────────────
        Tip(
            id: "17", category: "Strength", tag: "STRENGTH",
            title: "Core Strength", readTime: 4,
            desc: "A strong core keeps your form together in the final miles.",
            img: "https://images.pexels.com/photos/4162483/pexels-photo-4162483.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Your core is the transmission between your arms and legs. Studies show runners who add 20 minutes of core work twice a week improve running economy by 4–5%.",
            keyTakeaway: "Planks are 3x more effective for runners than sit-ups. Focus on anti-rotation, not flexion.",
            steps: [
                TipStep(title: "Plank Hold", desc: "3 x 45-second planks. Squeeze everything: glutes, quads, and shoulders."),
                TipStep(title: "Dead Bug", desc: "Opposite arm-leg extensions teach the core to stabilise during running motion."),
                TipStep(title: "Single-Leg Balance", desc: "Stand on one leg for 60 seconds with eyes closed. Challenges hip stabilisers."),
            ],
            viewCount: 11200
        ),
        Tip(
            id: "18", category: "Strength", tag: "STRENGTH",
            title: "Lift to Run Faster", readTime: 4,
            desc: "Lift weights to run faster without adding bulk.",
            img: "https://images.pexels.com/photos/2204196/pexels-photo-2204196.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "A 2016 meta-analysis of 26 studies found strength training improved running economy by an average of 6% — the equivalent of running faster for free.",
            keyTakeaway: "Two 30-minute strength sessions per week is all you need. More is not better for runners.",
            steps: [
                TipStep(title: "Bulgarian Split Squat", desc: "3 x 8 each leg. The single best exercise for runners — builds everything."),
                TipStep(title: "Romanian Deadlift", desc: "3 x 10 to strengthen hamstrings and glutes that power your stride."),
                TipStep(title: "Calf Raises", desc: "3 x 20 single-leg. Calves absorb 8x body weight with every footfall."),
            ],
            viewCount: 9700
        ),
        Tip(
            id: "19", category: "Strength", tag: "STRENGTH",
            title: "Group Running", readTime: 3,
            desc: "Find motivation and improve performance by running in a pack.",
            img: "https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Running with others creates social facilitation — a psychological phenomenon where performance improves by being around others. Studies show group runners go up to 5% faster at the same perceived effort.",
            keyTakeaway: "Join a group whose average pace is 5–10% faster than yours. The pull effect will improve you without conscious effort.",
            steps: [
                TipStep(title: "Find a Pack", desc: "Join a Ruvo club that matches your current pace level."),
                TipStep(title: "Sync Up", desc: "Fall into the group rhythm to conserve energy."),
                TipStep(title: "Drafting", desc: "On windy days, running behind others reduces your air resistance by up to 20%."),
            ],
            viewCount: 11200
        ),

        // ── GEAR ─────────────────────────────────────────────────
        Tip(
            id: "20", category: "Gear", tag: "GEAR",
            title: "Choosing Shoes", readTime: 4,
            desc: "The right shoes for your gait — and when to replace them.",
            img: "https://images.pexels.com/photos/2526878/pexels-photo-2526878.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Worn-out or wrong shoes cause over a third of running injuries. The midsole foam — not the outsole — is what provides cushioning, and it breaks down around 400–600 km.",
            keyTakeaway: "Note the date you start wearing a new pair in the Ruvo app. Retire them at 500 km without exception.",
            steps: [
                TipStep(title: "Know Your Arch", desc: "Wet test: step on paper. Flat = overpronator. High arch = neutral or supinator."),
                TipStep(title: "Buy in the Afternoon", desc: "Feet swell throughout the day. An afternoon fitting ensures no tight spots."),
                TipStep(title: "Track Mileage", desc: "Use Ruvo's Gear Tracker. Replace shoes every 500–700 km."),
            ],
            viewCount: 16700
        ),
        Tip(
            id: "21", category: "Gear", tag: "GEAR",
            title: "Night Running", readTime: 3,
            desc: "Stay safe and visible while owning the dark.",
            img: "https://images.pexels.com/photos/1671324/pexels-photo-1671324.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Night runs boost testosterone and growth hormone. But 65% of pedestrian accidents involve people in dark clothing. High-visibility gear reduces collision risk by 85%.",
            keyTakeaway: "A flashing rear light is more effective than reflective strips — the irregular flash pattern catches driver attention.",
            steps: [
                TipStep(title: "Front and Rear Lights", desc: "White front, red rear. Make yourself a moving vehicle, not a shadow."),
                TipStep(title: "Reflective Vest", desc: "Wear over your top. Choose 360° reflective strips."),
                TipStep(title: "Share Route", desc: "Drop a pin to a contact before every night run. Enable live sharing in Ruvo."),
            ],
            viewCount: 8900
        ),

        // ── RACE PREP ────────────────────────────────────────────
        Tip(
            id: "22", category: "Race Prep", tag: "RACE PREP",
            title: "Race Pacing", readTime: 4,
            desc: "Start slower than you think you need to — it's always worth it.",
            img: "https://images.pexels.com/photos/2524636/pexels-photo-2524636.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Race adrenaline makes the first mile feel effortlessly easy. This fools 90% of amateur runners into going out 15–20 seconds per km too fast, causing a catastrophic crash in the final third.",
            keyTakeaway: "Negative split (running the second half faster than the first) is optimal for almost every race distance.",
            steps: [
                TipStep(title: "Calculate Your Target", desc: "Your race pace should feel almost embarrassingly easy for the first 2 km."),
                TipStep(title: "Run Even Splits", desc: "Aim for every km within 3–5 seconds of your target. Your watch is your coach."),
                TipStep(title: "Save the Chase", desc: "If you feel strong at 75% through, then and only then start picking up pace."),
            ],
            viewCount: 13600
        ),
        Tip(
            id: "23", category: "Race Prep", tag: "RACE PREP",
            title: "Tapering Right", readTime: 4,
            desc: "The two weeks before a race require less running, not more.",
            img: "https://images.pexels.com/photos/3621183/pexels-photo-3621183.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Most recreational runners taper too little, fearing fitness loss. But training builds fitness for 10–14 days after the session. The last two weeks are already \"in the bank.\"",
            keyTakeaway: "Every extra training session in taper week costs you more in fatigue than it gains in fitness.",
            steps: [
                TipStep(title: "2 Weeks Out", desc: "Reduce volume by 40%. Keep intensity — a few short strides maintain sharpness."),
                TipStep(title: "1 Week Out", desc: "Reduce volume by 60%. Focus on sleep, nutrition, and light movement."),
                TipStep(title: "2 Days Before", desc: "Complete rest or a 10-minute easy jog. Nothing heroic."),
            ],
            viewCount: 11500
        ),
        Tip(
            id: "24", category: "Race Prep", tag: "RACE PREP",
            title: "Race Warm-Up", readTime: 3,
            desc: "The 20-minute routine that sets up a perfect start.",
            img: "https://images.pexels.com/photos/3621183/pexels-photo-3621183.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "A proper warm-up raises body temperature by 1–2°C, dilates blood vessels, and activates fast-twitch muscle fibres. This can improve performance in the first 2 km by 2–3%.",
            keyTakeaway: "Never static stretch before a race. Dynamic movements prime the system; static stretches relax it.",
            steps: [
                TipStep(title: "Easy Jog 10 Min", desc: "Build temperature gradually. Heart rate should reach 60–65% by the end."),
                TipStep(title: "Dynamic Drills", desc: "Leg swings, hip circles, high knees, butt kicks. 20 reps each."),
                TipStep(title: "Strides", desc: "Four 100m accelerations at race pace. Activate the fast-twitch system."),
            ],
            viewCount: 10200
        ),

        // ── INJURY PREVENTION ────────────────────────────────────
        Tip(
            id: "25", category: "Injury Prev", tag: "INJURY PREV",
            title: "The 10% Rule", readTime: 3,
            desc: "The most effective injury prevention strategy is also the simplest.",
            img: "https://images.pexels.com/photos/4048182/pexels-photo-4048182.jpeg?auto=compress&cs=tinysrgb&w=800",
            why: "Over 75% of running injuries are overuse injuries. Connective tissue adapts 3–4x slower than cardiovascular fitness, meaning you feel ready long before your joints are.",
            keyTakeaway: "Your cardiovascular system lies. It says \"I can run farther.\" Your connective tissue silently disagrees — until it snaps.",
            steps: [
                TipStep(title: "Track Weekly Mileage", desc: "Use Ruvo's run history to calculate your current weekly average."),
                TipStep(title: "Increase by Max 10%", desc: "If you're running 20 km/week, max increase is 2 km next week."),
                TipStep(title: "Build 3, Drop 1", desc: "After 3 weeks of increase, drop mileage by 30% for a recovery week."),
            ],
            viewCount: 14800
        ),
    ]

    /// Distinct categories in first-seen order (same order Android's own
    /// `CATEGORY_META` map declares them in `TipDetailScreen.kt`), used to
    /// drive filter-chip and section order instead of alphabetizing.
    static let categories: [String] = {
        var seen = Set<String>()
        var ordered: [String] = []
        for tip in all where !seen.contains(tip.category) {
            seen.insert(tip.category)
            ordered.append(tip.category)
        }
        return ordered
    }()
}

// MARK: – Category styling

/// Mirrors Android's private `CATEGORY_META` map in `TipDetailScreen.kt`
/// (same colors, same Material-icon-to-SF-Symbol intent per category).
struct TipCategoryMeta {
    let color: Color
    let icon: String
}

enum TipCategoryStyle {
    private static let meta: [String: TipCategoryMeta] = [
        "Technique": TipCategoryMeta(color: RuvoTheme.Colors.primary, icon: "speedometer"),
        "Nutrition": TipCategoryMeta(color: Color(hex: "#FF9500"), icon: "fork.knife"),
        "Recovery": TipCategoryMeta(color: Color(hex: "#5AC8FA"), icon: "bolt.batteryblock.fill"),
        "Mental": TipCategoryMeta(color: Color(hex: "#BF5AF2"), icon: "brain.head.profile"),
        "Strength": TipCategoryMeta(color: Color(hex: "#FF2D55"), icon: "dumbbell.fill"),
        "Gear": TipCategoryMeta(color: Color(hex: "#FFD700"), icon: "tshirt.fill"),
        "Race Prep": TipCategoryMeta(color: Color(hex: "#FF6B6B"), icon: "flag.checkered"),
        "Injury Prev": TipCategoryMeta(color: Color(hex: "#34C759"), icon: "cross.case.fill"),
    ]

    /// Falls back to the same default Android uses for an unknown category:
    /// primary color + a generic book icon (`Icons.Default.MenuBook`).
    static func meta(for category: String) -> TipCategoryMeta {
        meta[category] ?? TipCategoryMeta(color: RuvoTheme.Colors.primary, icon: "book.fill")
    }
}

// MARK: – Shared row

/// Shared list-row shape used both by the full library below and by
/// `HomeView`'s "Tips for Today" preview -- same thumbnail + tag + title +
/// one-line description + chevron as Android's `TipsForTodaySection` row
/// (`HomeScreen.kt`).
struct TipRow: View {
    let tip: Tip

    var body: some View {
        RuvoCard {
            HStack(spacing: RuvoTheme.Spacing.md) {
                AsyncImage(url: URL(string: tip.img)) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    RuvoTheme.Colors.surfaceElevated
                }
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: RuvoTheme.Radius.sm))

                VStack(alignment: .leading, spacing: 2) {
                    Text(tip.tag)
                        .font(RuvoTheme.Typography.labelSmall)
                        .tracking(RuvoTheme.Typography.Tracking.labelSmall)
                        .foregroundColor(TipCategoryStyle.meta(for: tip.category).color)
                    Text(tip.title)
                        .font(RuvoTheme.Typography.headingSmall)
                        .tracking(RuvoTheme.Typography.Tracking.headingSmall)
                        .foregroundColor(RuvoTheme.Colors.textPrimary)
                    Text(tip.desc)
                        .font(RuvoTheme.Typography.bodySmall)
                        .tracking(RuvoTheme.Typography.Tracking.bodySmall)
                        .foregroundColor(RuvoTheme.Colors.textSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(RuvoTheme.Colors.textTertiary)
            }
            .padding(RuvoTheme.Spacing.md)
        }
    }
}

// MARK: – Browse screen

/// Full tip library, browsable by category. Android itself never built a
/// dedicated "browse all tips" screen -- `TipsLibrary.ALL` (25 tips across 8
/// categories) is only ever surfaced as a random 4-tip "Tips for Today"
/// preview on Home (`HomeViewModel.loadDailyTips`) and as a personal
/// bookmark shelf on Profile (`ProfileScreen.kt`'s `SavedTipsCard`) -- both
/// linking straight to `TipDetailScreen`, never to a full list. This screen
/// is the missing piece: a real catalog browser over that same static data
/// (categories drawn straight from the `Tip.category` field every tip
/// already carries), reachable from Home's "See All" the same way
/// `RecentActivitySection`'s own "See All" reaches Analytics.
struct TipsView: View {
    @State private var selectedCategory: String?

    private var filtered: [Tip] {
        guard let selectedCategory else { return TipsLibrary.all }
        return TipsLibrary.all.filter { $0.category == selectedCategory }
    }

    var body: some View {
        VStack(spacing: 0) {
            categoryChips
                .padding(.top, RuvoTheme.Spacing.sm)

            ScrollView {
                LazyVStack(spacing: RuvoTheme.Spacing.sm) {
                    ForEach(filtered) { tip in
                        NavigationLink(value: AppRoute.tipDetail(tipId: tip.id)) {
                            TipRow(tip: tip)
                        }
                        .buttonStyle(ScaleButtonStyle())
                    }
                }
                .padding(RuvoTheme.Spacing.lg)
                .padding(.bottom, RuvoTheme.Spacing.xxl)
            }
        }
        .background(RuvoTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("Tips")
        .navigationBarTitleDisplayMode(.large)
    }

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: RuvoTheme.Spacing.sm) {
                categoryChip(label: "All", isSelected: selectedCategory == nil, color: RuvoTheme.Colors.primary) {
                    selectedCategory = nil
                }
                ForEach(TipsLibrary.categories, id: \.self) { category in
                    categoryChip(
                        label: category,
                        isSelected: selectedCategory == category,
                        color: TipCategoryStyle.meta(for: category).color
                    ) {
                        selectedCategory = category
                    }
                }
            }
            .padding(.horizontal, RuvoTheme.Spacing.md)
        }
    }

    private func categoryChip(label: String, isSelected: Bool, color: Color, action: @escaping () -> Void) -> some View {
        RuvoSelectionChip(
            label: label,
            isSelected: isSelected,
            shape: AnyShape(Capsule()),
            selectedColor: color,
            action: action
        )
        .frame(width: CGFloat(label.count) * 7.5 + 32, height: 36)
    }
}
