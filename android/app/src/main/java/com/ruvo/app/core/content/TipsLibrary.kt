package com.ruvo.app.core.content

import com.ruvo.app.core.model.Tip
import com.ruvo.app.core.model.TipStep

// Tip content is the source of truth here (mirrors the RN reference app's
// FALLBACK_TIPS) — Firestore's "content" collection only stores live view
// counts, refreshed in the background by ContentRepository.seedTipsToFirestore().
object TipsLibrary {
    val ALL: List<Tip> = listOf(
        // ── TECHNIQUE ────────────────────────────────────────────
        Tip(
            id = "1", category = "Technique", tag = "TECHNIQUE",
            title = "Trail Running", readTime = 3,
            desc = "Build ankle strength and stability on uneven terrain.",
            img = "https://images.pexels.com/photos/1571939/pexels-photo-1571939.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Uneven terrain forces stabilising muscles that road running ignores. Research shows trail runners have 25% fewer overuse injuries than road runners, because the body constantly adapts to micro-variations in the ground.",
            keyTakeaway = "Shorten your stride by 10% and lift your feet slightly higher — this alone reduces ankle rolls by half.",
            steps = listOf(
                TipStep("Scout the Route", "Check elevation maps and trail conditions before heading out."),
                TipStep("Shorten Your Stride", "Keep feet under your hips to react quickly to roots and rocks."),
                TipStep("Scan 10 Feet Ahead", "Look ahead, not at your feet. Your peripheral vision handles foot placement."),
            ),
            viewCount = 12500,
        ),
        Tip(
            id = "2", category = "Technique", tag = "TECHNIQUE",
            title = "Cadence Drills", readTime = 3,
            desc = "Improve efficiency by training your step rate to 180 spm.",
            img = "https://images.pexels.com/photos/4048182/pexels-photo-4048182.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Elite runners average 180 steps per minute. A higher cadence reduces ground contact time, lowering impact force on joints by up to 30%. Even a 5% increase in cadence can reduce knee stress significantly.",
            keyTakeaway = "Use a metronome app set to 180 bpm for one song per run until the rhythm becomes automatic.",
            steps = listOf(
                TipStep("Count Your Steps", "Count every right-foot strike for 30 seconds. Multiply by 4."),
                TipStep("Use a Metronome", "Set it to 170–180 bpm and match each beat to a foot strike."),
                TipStep("Shorten, Don't Speed", "Increase cadence by taking quicker, shorter steps — not running faster."),
            ),
            viewCount = 9800,
        ),
        Tip(
            id = "3", category = "Technique", tag = "TECHNIQUE",
            title = "Hill Repeats", readTime = 4,
            desc = "Build explosive leg power with structured uphill training.",
            img = "https://images.pexels.com/photos/1563277/pexels-photo-1563277.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Running uphill activates the glutes and hamstrings 30–40% more than flat running. Hill repeats build strength, improve VO2 max, and teach efficient form — all without the joint impact of track speed work.",
            keyTakeaway = "Drive your arms aggressively on uphills — your legs follow your arms.",
            steps = listOf(
                TipStep("Warm Up Flat", "10 minutes easy running before any hill work."),
                TipStep("Sprint Up", "Run hard uphill for 20–60 seconds, leaning slightly forward."),
                TipStep("Walk Down", "Use the descent as full recovery — never sprint downhill in training."),
            ),
            viewCount = 11800,
        ),
        Tip(
            id = "4", category = "Technique", tag = "TECHNIQUE",
            title = "Breathing Form", readTime = 3,
            desc = "Sync your breath to your stride to eliminate side stitches.",
            img = "https://images.pexels.com/photos/3621183/pexels-photo-3621183.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Most runners breathe shallowly from the chest. Diaphragmatic breathing delivers 40% more oxygen per breath and prevents the diaphragm cramp that causes side stitches.",
            keyTakeaway = "A 3:2 breathing ratio (inhale for 3 steps, exhale for 2) distributes foot strikes across both sides, reducing injury risk.",
            steps = listOf(
                TipStep("Belly Breathe", "Place a hand on your stomach — it should rise on the inhale, not your chest."),
                TipStep("Try 3:2 Rhythm", "Inhale for 3 footfalls, exhale for 2. Practice walking before running."),
                TipStep("Exhale Fully", "Force every bit of air out. A complete exhale creates a deeper inhale automatically."),
            ),
            viewCount = 8400,
        ),
        Tip(
            id = "5", category = "Technique", tag = "TECHNIQUE",
            title = "Running Posture", readTime = 3,
            desc = "A slight forward lean unlocks free speed and reduces fatigue.",
            img = "https://images.pexels.com/photos/1199590/pexels-photo-1199590.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Poor posture wastes energy on every single stride. Studies show optimal running posture improves economy by up to 8%, meaning you run faster on the same effort.",
            keyTakeaway = "Imagine a string pulling the top of your head toward the sky. This single cue corrects 80% of posture errors.",
            steps = listOf(
                TipStep("Tall Spine", "Ears over shoulders, shoulders over hips. Maintain this while running."),
                TipStep("Forward Lean", "Lean 5° forward from the ankles (not the waist). Use gravity to propel you."),
                TipStep("Arms at 90°", "Keep elbows bent at 90°. Swing forward-back, never across your body."),
            ),
            viewCount = 7200,
        ),

        // ── NUTRITION ────────────────────────────────────────────
        Tip(
            id = "6", category = "Nutrition", tag = "NUTRITION",
            title = "Pre-Run Fuel", readTime = 3,
            desc = "Time your carbs correctly and never hit the wall again.",
            img = "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Timing carbohydrates is as important as quantity. Eating complex carbs 2–3 hours before a run maximises glycogen stores. A small fast-digesting snack 30–45 minutes before tops up blood glucose without causing GI distress.",
            keyTakeaway = "A ripe banana with a tablespoon of peanut butter 45 minutes before running is nearly perfect sports nutrition.",
            steps = listOf(
                TipStep("3 Hours Before", "Eat a mixed meal: oats, rice, or pasta with some protein."),
                TipStep("45 Min Before", "Small fast-carb snack: banana, toast, or a sports gel."),
                TipStep("Avoid Fat & Fibre", "High-fat and high-fibre foods close to a run cause GI issues mid-stride."),
            ),
            viewCount = 15300,
        ),
        Tip(
            id = "7", category = "Nutrition", tag = "NUTRITION",
            title = "Hydration Hacks", readTime = 3,
            desc = "Stay perfectly hydrated without the sloshing mid-run.",
            img = "https://images.pexels.com/photos/4379227/pexels-photo-4379227.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Even 2% dehydration reduces running performance by up to 10%. But over-hydrating is equally dangerous. The goal is pre-loading smartly and sipping during, not gulping at once.",
            keyTakeaway = "Check your urine before heading out. Pale yellow = good. Dark yellow = drink 500ml before you leave.",
            steps = listOf(
                TipStep("Pre-Load Smart", "Drink 500ml of water 2 hours before, not right before the run."),
                TipStep("Sip, Don't Gulp", "Take small sips every 15–20 minutes. Large amounts cause sloshing and nausea."),
                TipStep("Add Electrolytes", "For runs over 60 min, add sodium to prevent hyponatremia."),
            ),
            viewCount = 14200,
        ),
        Tip(
            id = "8", category = "Nutrition", tag = "NUTRITION",
            title = "Recovery Meal", readTime = 3,
            desc = "The 30-minute window that determines tomorrow's performance.",
            img = "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Muscle protein synthesis peaks 30–60 minutes after a run. Consuming 20–30g of protein in this window accelerates muscle repair and reduces DOMS by up to 40%.",
            keyTakeaway = "A 4:1 carb-to-protein ratio immediately after hard runs is the scientifically optimal recovery ratio.",
            steps = listOf(
                TipStep("Within 30 Min", "Consume 20–30g protein + 60–80g carbohydrates immediately after."),
                TipStep("Chocolate Milk", "This natural drink has nearly the perfect 4:1 carb-to-protein ratio."),
                TipStep("Anti-Inflammatory Foods", "Add berries, turmeric, or tart cherry juice to reduce muscle inflammation."),
            ),
            viewCount = 10900,
        ),
        Tip(
            id = "9", category = "Nutrition", tag = "NUTRITION",
            title = "Race Day Nutrition", readTime = 4,
            desc = "What and when to eat to peak on race morning.",
            img = "https://images.pexels.com/photos/3622614/pexels-photo-3622614.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Race nerves suppress appetite but muscles still need fuel. Studies of marathon runners show those who eat a proper pre-race breakfast finish 8 minutes faster on average.",
            keyTakeaway = "Never try new foods or gels on race morning. Stick to exactly what you practiced in training.",
            steps = listOf(
                TipStep("3 Hours Before Gun", "Familiar carb-based breakfast: oatmeal, bagel, or white rice."),
                TipStep("60 Min Before", "One energy gel or banana + 400ml of water."),
                TipStep("During the Race", "Take gels at miles 5, 10, 18 for a marathon. Always with water, never sports drink."),
            ),
            viewCount = 13400,
        ),

        // ── RECOVERY ─────────────────────────────────────────────
        Tip(
            id = "10", category = "Recovery", tag = "RECOVERY",
            title = "Recovery Yoga", readTime = 4,
            desc = "Unlock tight hips and hamstrings after hard runs.",
            img = "https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Static stretching after a run helps realign muscle fibres and flush metabolic waste. Post-run yoga reduces delayed-onset muscle soreness by 30% and improves flexibility over time.",
            keyTakeaway = "Hold each pose for at least 60 seconds. Shorter holds provide no measurable flexibility benefit.",
            steps = listOf(
                TipStep("Downward Dog", "Hold 60 seconds to decompress the spine and stretch calves."),
                TipStep("Pigeon Pose", "Open up hip flexors. Hold 90 seconds each side."),
                TipStep("Deep Belly Breathing", "In each pose, exhale fully and deepen the stretch at the bottom of each breath."),
            ),
            viewCount = 18900,
        ),
        Tip(
            id = "11", category = "Recovery", tag = "RECOVERY",
            title = "Sleep Optimisation", readTime = 4,
            desc = "The single most powerful performance enhancer is free.",
            img = "https://images.pexels.com/photos/3771069/pexels-photo-3771069.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "During deep sleep, human growth hormone surges — muscles actually repair and grow. Research at Stanford showed athletes who extended sleep to 10 hours improved speed by 5% and reaction time by 15%.",
            keyTakeaway = "7–9 hours in a cool, dark room is more impactful than any supplement, stretch, or ice bath.",
            steps = listOf(
                TipStep("Cool the Room", "Ideal sleep temperature is 65–68°F (18–20°C). Body temperature must drop to trigger sleep."),
                TipStep("No Screens 60 Min Before", "Blue light suppresses melatonin. Use night mode or read instead."),
                TipStep("Consistent Wake Time", "Waking at the same time daily is more important than bedtime for sleep quality."),
            ),
            viewCount = 16100,
        ),
        Tip(
            id = "12", category = "Recovery", tag = "RECOVERY",
            title = "Foam Rolling", readTime = 3,
            desc = "Break up fascia knots before they become injuries.",
            img = "https://images.pexels.com/photos/4571319/pexels-photo-4571319.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Foam rolling releases myofascial tension. It improves range of motion more than static stretching in the immediate term, and reduces muscle soreness by increasing blood flow.",
            keyTakeaway = "Roll slowly and pause for 30–60 seconds on any tender point — that is exactly where you need it most.",
            steps = listOf(
                TipStep("IT Band", "Roll from hip to knee slowly. Pause on tight spots — up to 60 seconds."),
                TipStep("Calves", "Cross one leg over the other for more pressure. Point and flex your toes."),
                TipStep("Glutes", "Sit on the roller, cross one ankle over the opposite knee, lean to that side."),
            ),
            viewCount = 12700,
        ),
        Tip(
            id = "13", category = "Recovery", tag = "RECOVERY",
            title = "Active Recovery", readTime = 3,
            desc = "Why easy days are where your real fitness gains happen.",
            img = "https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Fitness is built during rest, not training. Active recovery flushes lactate, increases blood flow to repair tissue, and maintains aerobic conditioning without adding stress.",
            keyTakeaway = "If you can't hold a conversation, it's not a recovery run — it's just another hard day that blocks adaptation.",
            steps = listOf(
                TipStep("Easy Run", "Run at 60–65% max heart rate. You should talk in full sentences."),
                TipStep("Swim or Cycle", "These non-impact options move blood through muscles without joint stress."),
                TipStep("Walk", "30 minutes of walking improves recovery more than sitting still."),
            ),
            viewCount = 9300,
        ),

        //── MENTAL ───────────────────────────────────────────────
        Tip(
            id = "14", category = "Mental", tag = "MENTAL",
            title = "Mental Toughness", readTime = 4,
            desc = "Psychological tools to keep going when legs want to quit.",
            img = "https://images.pexels.com/photos/3775603/pexels-photo-3775603.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "In long races, athletes who hit the wall often still have glycogen remaining — they have reached their psychological limit, not their physical one. Mental training can delay this perceived limit by 8–12%.",
            keyTakeaway = "Split the remaining distance into small chunks. Your brain can endure almost anything when you only commit to the next 5 minutes.",
            steps = listOf(
                TipStep("Chunk It Down", "Never think about how far is left. Focus only on the next lamp post, the next mile."),
                TipStep("Positive Self-Talk", "Replace \"I can't\" with \"I am\" statements. \"I am strong, I am fast.\""),
                TipStep("Anchor Word", "Pick one word (e.g. \"power\"). Repeat it rhythmically with your stride."),
            ),
            viewCount = 10500,
        ),
        Tip(
            id = "15", category = "Mental", tag = "MENTAL",
            title = "Visualisation", readTime = 3,
            desc = "How elite runners mentally rehearse every race beforehand.",
            img = "https://images.pexels.com/photos/4498482/pexels-photo-4498482.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Brain scans show that mental imagery activates the same neural pathways as physical practice. Olympic athletes spend up to 30% of training time on visualisation.",
            keyTakeaway = "Visualise in first-person, not third-person. You should feel your feet hitting the ground, not watch yourself from above.",
            steps = listOf(
                TipStep("Find Quiet Space", "Sit comfortably, close your eyes. Breathe slowly for 2 minutes."),
                TipStep("Run the Race", "Mentally run your entire race in real time — every turn, every tough moment."),
                TipStep("Add Adversity", "Visualise things going wrong (bad weather, side stitch) and calmly overcoming them."),
            ),
            viewCount = 7800,
        ),
        Tip(
            id = "16", category = "Mental", tag = "MENTAL",
            title = "Flow State", readTime = 3,
            desc = "Trigger the runner's high on demand.",
            img = "https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Flow state — where running feels effortless — is triggered when challenge and skill are perfectly balanced. For runners it dramatically reduces perceived effort.",
            keyTakeaway = "Phone in your pocket, eyes forward, music at moderate volume. Distraction is the enemy of flow.",
            steps = listOf(
                TipStep("Match Challenge to Skill", "Pick a route that is challenging but not overwhelming for your current fitness."),
                TipStep("Single Focus", "Choose one thing to concentrate on — breathing, form, or a mantra."),
                TipStep("Remove Distractions", "Leave the notifications off. Check your watch maximum once per mile."),
            ),
            viewCount = 8900,
        ),

        //── STRENGTH ─────────────────────────────────────────────
        Tip(
            id = "17", category = "Strength", tag = "STRENGTH",
            title = "Core Strength", readTime = 4,
            desc = "A strong core keeps your form together in the final miles.",
            img = "https://images.pexels.com/photos/4162483/pexels-photo-4162483.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Your core is the transmission between your arms and legs. Studies show runners who add 20 minutes of core work twice a week improve running economy by 4–5%.",
            keyTakeaway = "Planks are 3x more effective for runners than sit-ups. Focus on anti-rotation, not flexion.",
            steps = listOf(
                TipStep("Plank Hold", "3 x 45-second planks. Squeeze everything: glutes, quads, and shoulders."),
                TipStep("Dead Bug", "Opposite arm-leg extensions teach the core to stabilise during running motion."),
                TipStep("Single-Leg Balance", "Stand on one leg for 60 seconds with eyes closed. Challenges hip stabilisers."),
            ),
            viewCount = 11200,
        ),
        Tip(
            id = "18", category = "Strength", tag = "STRENGTH",
            title = "Lift to Run Faster", readTime = 4,
            desc = "Lift weights to run faster without adding bulk.",
            img = "https://images.pexels.com/photos/2204196/pexels-photo-2204196.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "A 2016 meta-analysis of 26 studies found strength training improved running economy by an average of 6% — the equivalent of running faster for free.",
            keyTakeaway = "Two 30-minute strength sessions per week is all you need. More is not better for runners.",
            steps = listOf(
                TipStep("Bulgarian Split Squat", "3 x 8 each leg. The single best exercise for runners — builds everything."),
                TipStep("Romanian Deadlift", "3 x 10 to strengthen hamstrings and glutes that power your stride."),
                TipStep("Calf Raises", "3 x 20 single-leg. Calves absorb 8x body weight with every footfall."),
            ),
            viewCount = 9700,
        ),
        Tip(
            id = "19", category = "Strength", tag = "STRENGTH",
            title = "Group Running", readTime = 3,
            desc = "Find motivation and improve performance by running in a pack.",
            img = "https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Running with others creates social facilitation — a psychological phenomenon where performance improves by being around others. Studies show group runners go up to 5% faster at the same perceived effort.",
            keyTakeaway = "Join a group whose average pace is 5–10% faster than yours. The pull effect will improve you without conscious effort.",
            steps = listOf(
                TipStep("Find a Pack", "Join a Ruvo club that matches your current pace level."),
                TipStep("Sync Up", "Fall into the group rhythm to conserve energy."),
                TipStep("Drafting", "On windy days, running behind others reduces your air resistance by up to 20%."),
            ),
            viewCount = 11200,
        ),

        // ── GEAR ─────────────────────────────────────────────────
        Tip(
            id = "20", category = "Gear", tag = "GEAR",
            title = "Choosing Shoes", readTime = 4,
            desc = "The right shoes for your gait — and when to replace them.",
            img = "https://images.pexels.com/photos/2526878/pexels-photo-2526878.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Worn-out or wrong shoes cause over a third of running injuries. The midsole foam — not the outsole — is what provides cushioning, and it breaks down around 400–600 km.",
            keyTakeaway = "Note the date you start wearing a new pair in the Ruvo app. Retire them at 500 km without exception.",
            steps = listOf(
                TipStep("Know Your Arch", "Wet test: step on paper. Flat = overpronator. High arch = neutral or supinator."),
                TipStep("Buy in the Afternoon", "Feet swell throughout the day. An afternoon fitting ensures no tight spots."),
                TipStep("Track Mileage", "Use Ruvo's Gear Tracker. Replace shoes every 500–700 km."),
            ),
            viewCount = 16700,
        ),
        Tip(
            id = "21", category = "Gear", tag = "GEAR",
            title = "Night Running", readTime = 3,
            desc = "Stay safe and visible while owning the dark.",
            img = "https://images.pexels.com/photos/1671324/pexels-photo-1671324.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Night runs boost testosterone and growth hormone. But 65% of pedestrian accidents involve people in dark clothing. High-visibility gear reduces collision risk by 85%.",
            keyTakeaway = "A flashing rear light is more effective than reflective strips — the irregular flash pattern catches driver attention.",
            steps = listOf(
                TipStep("Front and Rear Lights", "White front, red rear. Make yourself a moving vehicle, not a shadow."),
                TipStep("Reflective Vest", "Wear over your top. Choose 360° reflective strips."),
                TipStep("Share Route", "Drop a pin to a contact before every night run. Enable live sharing in Ruvo."),
            ),
            viewCount = 8900,
        ),

        // ── RACE PREP ────────────────────────────────────────────
        Tip(
            id = "22", category = "Race Prep", tag = "RACE PREP",
            title = "Race Pacing", readTime = 4,
            desc = "Start slower than you think you need to — it's always worth it.",
            img = "https://images.pexels.com/photos/2524636/pexels-photo-2524636.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Race adrenaline makes the first mile feel effortlessly easy. This fools 90% of amateur runners into going out 15–20 seconds per km too fast, causing a catastrophic crash in the final third.",
            keyTakeaway = "Negative split (running the second half faster than the first) is optimal for almost every race distance.",
            steps = listOf(
                TipStep("Calculate Your Target", "Your race pace should feel almost embarrassingly easy for the first 2 km."),
                TipStep("Run Even Splits", "Aim for every km within 3–5 seconds of your target. Your watch is your coach."),
                TipStep("Save the Chase", "If you feel strong at 75% through, then and only then start picking up pace."),
            ),
            viewCount = 13600,
        ),
        Tip(
            id = "23", category = "Race Prep", tag = "RACE PREP",
            title = "Tapering Right", readTime = 4,
            desc = "The two weeks before a race require less running, not more.",
            img = "https://images.pexels.com/photos/3621183/pexels-photo-3621183.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Most recreational runners taper too little, fearing fitness loss. But training builds fitness for 10–14 days after the session. The last two weeks are already \"in the bank.\"",
            keyTakeaway = "Every extra training session in taper week costs you more in fatigue than it gains in fitness.",
            steps = listOf(
                TipStep("2 Weeks Out", "Reduce volume by 40%. Keep intensity — a few short strides maintain sharpness."),
                TipStep("1 Week Out", "Reduce volume by 60%. Focus on sleep, nutrition, and light movement."),
                TipStep("2 Days Before", "Complete rest or a 10-minute easy jog. Nothing heroic."),
            ),
            viewCount = 11500,
        ),
        Tip(
            id = "24", category = "Race Prep", tag = "RACE PREP",
            title = "Race Warm-Up", readTime = 3,
            desc = "The 20-minute routine that sets up a perfect start.",
            img = "https://images.pexels.com/photos/3621183/pexels-photo-3621183.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "A proper warm-up raises body temperature by 1–2°C, dilates blood vessels, and activates fast-twitch muscle fibres. This can improve performance in the first 2 km by 2–3%.",
            keyTakeaway = "Never static stretch before a race. Dynamic movements prime the system; static stretches relax it.",
            steps = listOf(
                TipStep("Easy Jog 10 Min", "Build temperature gradually. Heart rate should reach 60–65% by the end."),
                TipStep("Dynamic Drills", "Leg swings, hip circles, high knees, butt kicks. 20 reps each."),
                TipStep("Strides", "Four 100m accelerations at race pace. Activate the fast-twitch system."),
            ),
            viewCount = 10200,
        ),

        // ── INJURY PREVENTION ────────────────────────────────────
        Tip(
            id = "25", category = "Injury Prev", tag = "INJURY PREV",
            title = "The 10% Rule", readTime = 3,
            desc = "The most effective injury prevention strategy is also the simplest.",
            img = "https://images.pexels.com/photos/4048182/pexels-photo-4048182.jpeg?auto=compress&cs=tinysrgb&w=800",
            why = "Over 75% of running injuries are overuse injuries. Connective tissue adapts 3–4x slower than cardiovascular fitness, meaning you feel ready long before your joints are.",
            keyTakeaway = "Your cardiovascular system lies. It says \"I can run farther.\" Your connective tissue silently disagrees — until it snaps.",
            steps = listOf(
                TipStep("Track Weekly Mileage", "Use Ruvo's run history to calculate your current weekly average."),
                TipStep("Increase by Max 10%", "If you're running 20 km/week, max increase is 2 km next week."),
                TipStep("Build 3, Drop 1", "After 3 weeks of increase, drop mileage by 30% for a recovery week."),
            ),
            viewCount = 14800,
        ),
    )
}
