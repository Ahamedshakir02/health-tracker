// GENERATED from Gym_Training_Plan.docx — do not hand-edit.
// Revolution Gym & Fitness schedule book: 13 schedules,
// 46 training days, 360 exercises.
// Illustrations live in /exercises and are referenced by filename.

export interface PlanExercise {
  n: number;
  name: string;
  cue: string;
  img: string | null;
}

export interface PlanSection {
  name: string;
  exercises: PlanExercise[];
}

export interface PlanDay {
  n: number;
  focus: string;
  reps: string;
  sections: PlanSection[];
}

export interface Schedule {
  id: number;
  title: string;
  subtitle: string;
  days: PlanDay[];
}

export const TRAINING_PLAN: Schedule[] = [
  {
    "id": 1,
    "title": "Schedule 1",
    "subtitle": "15 x 3 reps × sets   ·   4 training days   ·   29 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Triceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Flat Bench Barbell Press",
                "cue": "Bar to mid-chest, elbows ~45°, drive up and squeeze.",
                "img": "96c84c26183465f6.png"
              },
              {
                "n": 2,
                "name": "Inclined Dumbell Press",
                "cue": "Dumbbells meet at the top, don't clang.",
                "img": "acbf3f5e1dd2c904.png"
              },
              {
                "n": 3,
                "name": "Seated Machine Chest Press",
                "cue": "Back flat, press without locking harshly.",
                "img": "db7df4e88a5c42c8.png"
              },
              {
                "n": 4,
                "name": "Pec Deck",
                "cue": "Slow return — resist the pads all the way back.",
                "img": "4f5740dd8e4e275b.png"
              }
            ]
          },
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Skull Crusher",
                "cue": "Elbows fixed and pointed up, bar to forehead.",
                "img": "ac0d43ac979f83d2.png"
              },
              {
                "n": 2,
                "name": "Dumbell Extension",
                "cue": "Elbows tight to the head, full stretch behind.",
                "img": "432b1b21c1f322a8.png"
              },
              {
                "n": 3,
                "name": "Pulley Pushdown",
                "cue": "Elbows pinned to the ribs, full squeeze at the bottom.",
                "img": "73611dc2859357ec.png"
              },
              {
                "n": 4,
                "name": "Kick Back",
                "cue": "Upper arm parallel to the floor, only the elbow moves.",
                "img": "ff2d26cb20de4ce0.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Wings / Back / Biceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "Lat Pulldown Front",
                "cue": "Bar to the collarbone, drive the elbows down.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 2,
                "name": "Mid Row",
                "cue": "Pull to the ribs, pause, control back out.",
                "img": "b0230db760ad3de3.png"
              },
              {
                "n": 3,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 4,
                "name": "Seated Lower Pull",
                "cue": "Chest tall, pull to the navel, squeeze the blades.",
                "img": "b0230db760ad3de3.png"
              }
            ]
          },
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Curl",
                "cue": "Elbows glued to the sides, no hip swing.",
                "img": "801ec5362733929b.png"
              },
              {
                "n": 2,
                "name": "Dumbell Curl",
                "cue": "Supinate as you curl — turn the pinky up.",
                "img": "2858615a531b5b32.png"
              },
              {
                "n": 3,
                "name": "Cable Curl",
                "cue": "Constant tension — cables never let the biceps rest.",
                "img": "356b78e958b6383a.png"
              },
              {
                "n": 4,
                "name": "Machine Preacher Curl",
                "cue": "Fixed path — pause at the top of every rep.",
                "img": "005b7c31f05c3f53.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Shoulder / Forearms",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Machine Shoulder Press",
                "cue": "Back to the pad, press without shrugging.",
                "img": "65cbb3c506267caf.png"
              },
              {
                "n": 2,
                "name": "Standing Dumbell Press",
                "cue": "Brace the core, press straight overhead.",
                "img": "9fe9659e9cfe460b.png"
              },
              {
                "n": 3,
                "name": "Dumbell Front Raise",
                "cue": "Raise to eye level, thumbs slightly up.",
                "img": "b1b56fccf6670b33.png"
              },
              {
                "n": 4,
                "name": "Barbell Shruggle",
                "cue": "Shrug straight up — no rolling the shoulders.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Reverse Curl",
                "cue": "Overhand grip, wrists locked straight.",
                "img": "13cd9d0a202d965d.png"
              },
              {
                "n": 2,
                "name": "Dumbell Hammer Curl",
                "cue": "Neutral grip, no swinging.",
                "img": "615605a597057366.png"
              },
              {
                "n": 3,
                "name": "Cable Reverse Curl",
                "cue": "Overhand cable curl, elbows still.",
                "img": "48e85ff9a488133b.png"
              },
              {
                "n": 4,
                "name": "Back Wrist Curl",
                "cue": "Palms down — extensor side of the forearm.",
                "img": "d4023feab9310475.png"
              }
            ]
          }
        ]
      },
      {
        "n": 4,
        "focus": "Legs",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Dumbell Front Squat",
                "cue": "Dumbbell at the chest, sit between the heels.",
                "img": "511490a42c65a560.png"
              },
              {
                "n": 2,
                "name": "Dumbell Lunges",
                "cue": "Long step, back knee to just off the floor.",
                "img": "82875bd7948016ee.png"
              },
              {
                "n": 3,
                "name": "Leg Curl",
                "cue": "Hips down on the pad, curl the heels to the glutes.",
                "img": "086ab15078d42cfb.png"
              },
              {
                "n": 4,
                "name": "Leg Extension",
                "cue": "Squeeze at full extension, slow negative.",
                "img": "e0774c1b20de42a9.png"
              },
              {
                "n": 5,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 2,
    "title": "Schedule 2",
    "subtitle": "15 x 3 reps × sets   ·   4 training days   ·   30 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Triceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Incline Barbell Press",
                "cue": "30–45° bench, bar to upper chest.",
                "img": "993de78056b8d3b9.png"
              },
              {
                "n": 2,
                "name": "Flat Barbell Bench Press",
                "cue": "Shoulder blades pinned back, bar to nipple line.",
                "img": "96c84c26183465f6.png"
              },
              {
                "n": 3,
                "name": "Flat Dumbell Bench Fly",
                "cue": "Wide arc, stretch the pecs, no pressing.",
                "img": "4b55100d8cb65266.png"
              },
              {
                "n": 4,
                "name": "Pec Deck",
                "cue": "Slow return — resist the pads all the way back.",
                "img": "4f5740dd8e4e275b.png"
              }
            ]
          },
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell French Press",
                "cue": "Seated, bar behind the head, elbows still.",
                "img": "6d693faa3938847a.png"
              },
              {
                "n": 2,
                "name": "One Arm Dumbell Extension",
                "cue": "One arm at a time, other hand braces the elbow.",
                "img": "432b1b21c1f322a8.png"
              },
              {
                "n": 3,
                "name": "Cable Overhead",
                "cue": "Face away, elbows high and still.",
                "img": "c54493420f57a7c7.png"
              },
              {
                "n": 4,
                "name": "Kick Back",
                "cue": "Upper arm parallel to the floor, only the elbow moves.",
                "img": "ff2d26cb20de4ce0.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Wings / Back / Biceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "Lat Pull Down Back",
                "cue": "Behind the neck — light weight, controlled.",
                "img": "263e4e1c5ae4a030.png"
              },
              {
                "n": 2,
                "name": "Spider Row",
                "cue": "Chest supported — pure back work.",
                "img": "f05787bd352b7f0b.png"
              },
              {
                "n": 3,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 4,
                "name": "Reverse Lat Pull Down",
                "cue": "Supinated grip, elbows to the hips.",
                "img": "ade028eeda5d0f88.png"
              }
            ]
          },
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Curl",
                "cue": "Elbows glued to the sides, no hip swing.",
                "img": "801ec5362733929b.png"
              },
              {
                "n": 2,
                "name": "Seated Dumbell Curl",
                "cue": "Seated kills the cheat — strict reps only.",
                "img": "94072b50007120cb.png"
              },
              {
                "n": 3,
                "name": "Cable Curl",
                "cue": "Constant tension — cables never let the biceps rest.",
                "img": "356b78e958b6383a.png"
              },
              {
                "n": 4,
                "name": "Manual Preacher Curl",
                "cue": "Free bar on the preacher bench.",
                "img": "005b7c31f05c3f53.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Shoulder / Forearms",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Shoulder Press Machine",
                "cue": "Handles at ear height to start.",
                "img": "65cbb3c506267caf.png"
              },
              {
                "n": 2,
                "name": "Seated Dumbell Press",
                "cue": "Seated and supported — no leg drive.",
                "img": "5b1757d1d6bbc48c.png"
              },
              {
                "n": 3,
                "name": "Barbell Front Raise",
                "cue": "Straight arms, stop at shoulder height.",
                "img": "a76e66576f2968dd.png"
              },
              {
                "n": 4,
                "name": "Barbell Shruggle",
                "cue": "Shrug straight up — no rolling the shoulders.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Reverse Curl",
                "cue": "Overhand grip, wrists locked straight.",
                "img": "13cd9d0a202d965d.png"
              },
              {
                "n": 2,
                "name": "2 Arm Dumbell Hammer",
                "cue": "Both arms together, strict.",
                "img": "615605a597057366.png"
              },
              {
                "n": 3,
                "name": "Cable Reverse Curl",
                "cue": "Overhand cable curl, elbows still.",
                "img": "48e85ff9a488133b.png"
              },
              {
                "n": 4,
                "name": "Wrist Curl Machine",
                "cue": "Fixed path, small controlled range.",
                "img": "fd0a082a5f38ad1f.png"
              }
            ]
          }
        ]
      },
      {
        "n": 4,
        "focus": "Legs",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Leg Squat",
                "cue": "Full depth, controlled on the way down.",
                "img": "687f51d28b944606.png"
              },
              {
                "n": 2,
                "name": "Dumbell Lunges",
                "cue": "Long step, back knee to just off the floor.",
                "img": "82875bd7948016ee.png"
              },
              {
                "n": 3,
                "name": "Leg Curl",
                "cue": "Hips down on the pad, curl the heels to the glutes.",
                "img": "086ab15078d42cfb.png"
              },
              {
                "n": 4,
                "name": "Sumo Squat",
                "cue": "Wide stance, toes out, drive the knees apart.",
                "img": "687f51d28b944606.png"
              },
              {
                "n": 5,
                "name": "Extension",
                "cue": "Pause a beat at the top of each rep.",
                "img": "e0774c1b20de42a9.png"
              },
              {
                "n": 6,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 3,
    "title": "Schedule 3",
    "subtitle": "15 x 3 reps × sets   ·   4 training days   ·   28 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Triceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Decline Barbell Press",
                "cue": "Lower chest, bar to the sternum line.",
                "img": "62ef2fb91eef2586.png"
              },
              {
                "n": 2,
                "name": "Flat Bench Dumbell Press",
                "cue": "Palms forward, elbows under the wrists.",
                "img": "3cf3443167a3d569.png"
              },
              {
                "n": 3,
                "name": "Butterfly",
                "cue": "Elbows level with the shoulders, squeeze 1 sec.",
                "img": "4f5740dd8e4e275b.png"
              },
              {
                "n": 4,
                "name": "Pullover",
                "cue": "Hips low, big stretch over the head, ribcage expands.",
                "img": "5b955a0a7b7f57f7.png"
              }
            ]
          },
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Machine French Press",
                "cue": "Fixed path — chase the squeeze, not the weight.",
                "img": "5523efa2846ecdf1.png"
              },
              {
                "n": 2,
                "name": "Lying Dumbell Extension",
                "cue": "Dumbbells to the ears, elbows vertical.",
                "img": "bb094553b2f690ae.png"
              },
              {
                "n": 3,
                "name": "V Bar Pulley Push Down",
                "cue": "V-bar grip, thumbs high.",
                "img": "73611dc2859357ec.png"
              },
              {
                "n": 4,
                "name": "2 Arm Kick Back",
                "cue": "Both arms together, hinge at the hips.",
                "img": "ff2d26cb20de4ce0.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Wings / Back / Biceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "Lat Pull Down Front",
                "cue": "Chest up, lead with the elbows not the hands.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 2,
                "name": "T Bar Rowing",
                "cue": "Flat back, pull the handles into the belly.",
                "img": "56dde8049b870598.png"
              },
              {
                "n": 3,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 4,
                "name": "Seated Lowerpull",
                "cue": "Don't round the back on the return.",
                "img": "b0230db760ad3de3.png"
              }
            ]
          },
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Z Bar Curl",
                "cue": "EZ bar takes the strain off the wrists.",
                "img": "760267dfd5299c3d.png"
              },
              {
                "n": 2,
                "name": "Inc Dumbell Curl Two Arm",
                "cue": "Let the arms hang fully back at the bottom.",
                "img": "a54ac5061a0b5cac.png"
              },
              {
                "n": 3,
                "name": "Cable Curl",
                "cue": "Constant tension — cables never let the biceps rest.",
                "img": "356b78e958b6383a.png"
              },
              {
                "n": 4,
                "name": "Concentration",
                "cue": "Elbow on the inner thigh, squeeze at the top.",
                "img": "62dddffaf34acdca.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Shoulder / Forearms",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Smith Shoulder Press",
                "cue": "Seated Smith press, back supported.",
                "img": "87b97985e8075344.png"
              },
              {
                "n": 2,
                "name": "Arnold Press",
                "cue": "Start palms in, rotate out as you press up.",
                "img": "f93a3cf2f9371e5a.png"
              },
              {
                "n": 3,
                "name": "Side Lateral Raise",
                "cue": "Lead with the elbows, pinkies slightly high.",
                "img": "b781dfd732479df7.png"
              },
              {
                "n": 4,
                "name": "Shruggle",
                "cue": "Hold the top for a full second.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Rev Curl",
                "cue": "Overhand curl for the forearm extensors.",
                "img": "13cd9d0a202d965d.png"
              },
              {
                "n": 2,
                "name": "Seated Hammer Curl",
                "cue": "Seated — removes the body swing.",
                "img": "615605a597057366.png"
              },
              {
                "n": 3,
                "name": "Cable Curl Reverse",
                "cue": "Slow both directions.",
                "img": "48e85ff9a488133b.png"
              },
              {
                "n": 4,
                "name": "Wrist Curl",
                "cue": "Full range — let the bar roll to the fingertips.",
                "img": "470deaa3adcf4765.png"
              }
            ]
          }
        ]
      },
      {
        "n": 4,
        "focus": "Legs",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Squats",
                "cue": "Chest up, knees tracking the toes, hips to parallel.",
                "img": "687f51d28b944606.png"
              },
              {
                "n": 2,
                "name": "Dumbell Lunges",
                "cue": "Long step, back knee to just off the floor.",
                "img": "82875bd7948016ee.png"
              },
              {
                "n": 3,
                "name": "Leg Curl",
                "cue": "Hips down on the pad, curl the heels to the glutes.",
                "img": "086ab15078d42cfb.png"
              },
              {
                "n": 4,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 4,
    "title": "Schedule 4",
    "subtitle": "12 x 4 reps × sets   ·   3 training days   ·   25 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Triceps",
        "reps": "12 x 4",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Half Flat Bench Press",
                "cue": "Half range — stop mid-way, keep constant tension.",
                "img": "96c84c26183465f6.png"
              },
              {
                "n": 2,
                "name": "Incline Half Dumbell Press",
                "cue": "Half range only — constant tension.",
                "img": "acbf3f5e1dd2c904.png"
              },
              {
                "n": 3,
                "name": "Seated Chest Press Mid Hand",
                "cue": "Middle grip — even chest and triceps load.",
                "img": "db7df4e88a5c42c8.png"
              },
              {
                "n": 4,
                "name": "Dumbell Fly",
                "cue": "Soft elbow bend, hug the movement in.",
                "img": "4b55100d8cb65266.png"
              }
            ]
          },
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Triceps Close Grip",
                "cue": "Narrow grip — triceps do the work, not the chest.",
                "img": "4b58aed60969dca9.png"
              },
              {
                "n": 2,
                "name": "Dumbell Extension Minus",
                "cue": "Drop-set style: strip weight each round.",
                "img": "432b1b21c1f322a8.png"
              },
              {
                "n": 3,
                "name": "Cable Overhead with Pulley Pushdown",
                "cue": "Superset overhead into pushdowns.",
                "img": "c54493420f57a7c7.png"
              },
              {
                "n": 4,
                "name": "Parallel Dips",
                "cue": "Stay upright to keep the load on the triceps.",
                "img": "c801e195ca8ff3aa.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Wings / Back / Biceps",
        "reps": "12 x 4",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "Lat Pull Down Front",
                "cue": "Chest up, lead with the elbows not the hands.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 2,
                "name": "Lat Side Pullover",
                "cue": "Cable or dumbbell — long stretch through the lat.",
                "img": "5b955a0a7b7f57f7.png"
              },
              {
                "n": 3,
                "name": "Seated Lower Pull",
                "cue": "Chest tall, pull to the navel, squeeze the blades.",
                "img": "b0230db760ad3de3.png"
              },
              {
                "n": 4,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              }
            ]
          },
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Curl (Plus)",
                "cue": "Add weight every set, drop the reps.",
                "img": "801ec5362733929b.png"
              },
              {
                "n": 2,
                "name": "Onearm Dumbell Curl",
                "cue": "One arm at a time, full supination.",
                "img": "2858615a531b5b32.png"
              },
              {
                "n": 3,
                "name": "V Bar Cable Curl",
                "cue": "V-bar handle, squeeze hard at the top.",
                "img": "356b78e958b6383a.png"
              },
              {
                "n": 4,
                "name": "Preacher Curl (-)",
                "cue": "Drop set on the preacher bench.",
                "img": "005b7c31f05c3f53.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Shoulder / Forearms",
        "reps": "12 x 4",
        "sections": [
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Upright Row",
                "cue": "Bar close to the body, elbows lead above the wrists.",
                "img": "bb0c5bb34e592f48.png"
              },
              {
                "n": 2,
                "name": "Barbell Back Press",
                "cue": "Behind the neck — go light, control it.",
                "img": "0a82929370f65ba9.png"
              },
              {
                "n": 3,
                "name": "Side Lateral Raise with Dumbell Press",
                "cue": "Raise, then press — one continuous set.",
                "img": "b781dfd732479df7.png"
              },
              {
                "n": 4,
                "name": "Shruggle",
                "cue": "Hold the top for a full second.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Reverse Chinups",
                "cue": "Overhand grip chin-ups — grip and forearm work.",
                "img": "21a4d8402d8588f8.png"
              },
              {
                "n": 2,
                "name": "Reverse Barbell Curl",
                "cue": "Light weight — the forearms tire fast.",
                "img": "13cd9d0a202d965d.png"
              },
              {
                "n": 3,
                "name": "Reverse Cable Curl",
                "cue": "Constant tension on the forearms.",
                "img": "48e85ff9a488133b.png"
              },
              {
                "n": 4,
                "name": "Dumbell Hammer Curl",
                "cue": "Neutral grip, no swinging.",
                "img": "615605a597057366.png"
              },
              {
                "n": 5,
                "name": "Wrist Curl",
                "cue": "Forearms on the thighs, palms up, curl the wrists.",
                "img": "470deaa3adcf4765.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 5,
    "title": "Schedule 5",
    "subtitle": "15 x 3 reps × sets   ·   3 training days   ·   37 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Biceps / Forearms",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Dumbell Pullover",
                "cue": "One dumbbell, both hands, slow arc.",
                "img": "5b955a0a7b7f57f7.png"
              },
              {
                "n": 2,
                "name": "Pec Deck",
                "cue": "Slow return — resist the pads all the way back.",
                "img": "4f5740dd8e4e275b.png"
              },
              {
                "n": 3,
                "name": "Seated Inc Chest Press",
                "cue": "Back flat to the pad, press up and slightly in.",
                "img": "993de78056b8d3b9.png"
              },
              {
                "n": 4,
                "name": "Butterfly",
                "cue": "Elbows level with the shoulders, squeeze 1 sec.",
                "img": "4f5740dd8e4e275b.png"
              },
              {
                "n": 5,
                "name": "Flat Dumbell Press",
                "cue": "Deep stretch, squeeze at the top.",
                "img": "3cf3443167a3d569.png"
              },
              {
                "n": 6,
                "name": "Dec Bar Bench Press",
                "cue": "Decline bench, controlled tempo.",
                "img": "62ef2fb91eef2586.png"
              }
            ]
          },
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Chinups",
                "cue": "Underhand grip, chin clears the bar.",
                "img": "21a4d8402d8588f8.png"
              },
              {
                "n": 2,
                "name": "Concentration",
                "cue": "Elbow on the inner thigh, squeeze at the top.",
                "img": "62dddffaf34acdca.png"
              },
              {
                "n": 3,
                "name": "Preacher Curl (Z)",
                "cue": "EZ bar on the preacher pad.",
                "img": "005b7c31f05c3f53.png"
              },
              {
                "n": 4,
                "name": "3 Part Cable Curl",
                "cue": "Bottom third, top third, then full reps.",
                "img": "356b78e958b6383a.png"
              },
              {
                "n": 5,
                "name": "2 Arm Dumbell Curl (Inc)",
                "cue": "Incline bench — biggest stretch on the long head.",
                "img": "a54ac5061a0b5cac.png"
              },
              {
                "n": 6,
                "name": "Bar Curl Hold (1,2,..7)",
                "cue": "Curl and hold, adding a second each rep.",
                "img": "801ec5362733929b.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Hammer Curl",
                "cue": "Thumbs up throughout.",
                "img": "615605a597057366.png"
              },
              {
                "n": 2,
                "name": "Back Wrist Curl",
                "cue": "Palms down — extensor side of the forearm.",
                "img": "d4023feab9310475.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Wings / Back / Triceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "Pull Ups",
                "cue": "Full hang to chin over bar. Assist if needed.",
                "img": "2dc16082d6695577.png"
              },
              {
                "n": 2,
                "name": "Seated Lower Pull",
                "cue": "Chest tall, pull to the navel, squeeze the blades.",
                "img": "b0230db760ad3de3.png"
              },
              {
                "n": 3,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 4,
                "name": "Reverse Latpull Down",
                "cue": "Underhand, squeeze the lower lats.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 5,
                "name": "T Bar Latpull Down",
                "cue": "T-bar attachment, neutral grip pulldown.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 6,
                "name": "Lat Pulldown Back",
                "cue": "Bar to the base of the neck, don't force it.",
                "img": "263e4e1c5ae4a030.png"
              }
            ]
          },
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Bench Dips",
                "cue": "Hands on the bench behind, dip to 90°.",
                "img": "065c6ea8dbb2ddb2.png"
              },
              {
                "n": 2,
                "name": "Kick Back",
                "cue": "Upper arm parallel to the floor, only the elbow moves.",
                "img": "ff2d26cb20de4ce0.png"
              },
              {
                "n": 3,
                "name": "Pulley Pushdown",
                "cue": "Elbows pinned to the ribs, full squeeze at the bottom.",
                "img": "73611dc2859357ec.png"
              },
              {
                "n": 4,
                "name": "Dumbell Extension",
                "cue": "Elbows tight to the head, full stretch behind.",
                "img": "432b1b21c1f322a8.png"
              },
              {
                "n": 5,
                "name": "Cable Overhead",
                "cue": "Face away, elbows high and still.",
                "img": "c54493420f57a7c7.png"
              },
              {
                "n": 6,
                "name": "Z Bar Lying Press",
                "cue": "EZ bar close grip, lower to the forehead.",
                "img": "ac0d43ac979f83d2.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Shoulder / Legs",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Shruggle",
                "cue": "Hold the top for a full second.",
                "img": "dda4d225ec97bf53.png"
              },
              {
                "n": 2,
                "name": "Upright Row",
                "cue": "Bar close to the body, elbows lead above the wrists.",
                "img": "bb0c5bb34e592f48.png"
              },
              {
                "n": 3,
                "name": "Side Raise",
                "cue": "Light weight, slow lower.",
                "img": "b781dfd732479df7.png"
              },
              {
                "n": 4,
                "name": "Dumbell Press (One by One)",
                "cue": "Alternate arms — brace against the twist.",
                "img": "9fe9659e9cfe460b.png"
              },
              {
                "n": 5,
                "name": "Barbell Press",
                "cue": "Bar from the collarbone, straight overhead.",
                "img": "0a82929370f65ba9.png"
              },
              {
                "n": 6,
                "name": "Back Pullups",
                "cue": "Wide overhand pull-ups for the upper back.",
                "img": "2dc16082d6695577.png"
              }
            ]
          },
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Squat",
                "cue": "Brace hard, sit down and back.",
                "img": "687f51d28b944606.png"
              },
              {
                "n": 2,
                "name": "Leg Press",
                "cue": "Feet mid-platform, don't lock the knees out hard.",
                "img": "fe4c89790a6ac63e.png"
              },
              {
                "n": 3,
                "name": "Dumbell Lunges",
                "cue": "Long step, back knee to just off the floor.",
                "img": "82875bd7948016ee.png"
              },
              {
                "n": 4,
                "name": "Leg Curl",
                "cue": "Hips down on the pad, curl the heels to the glutes.",
                "img": "086ab15078d42cfb.png"
              },
              {
                "n": 5,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 6,
    "title": "Schedule 6",
    "subtitle": "15 x 3 reps × sets   ·   4 training days   ·   27 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Triceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Bench Press (F, I, D)",
                "cue": "One set each: flat, incline, decline, no rest.",
                "img": "96c84c26183465f6.png"
              },
              {
                "n": 2,
                "name": "Cable Crossover",
                "cue": "Slight forward lean, cross the hands at the bottom.",
                "img": "4f5740dd8e4e275b.png"
              },
              {
                "n": 3,
                "name": "Pec Deck",
                "cue": "Slow return — resist the pads all the way back.",
                "img": "4f5740dd8e4e275b.png"
              }
            ]
          },
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Lying Press (F, I, D)",
                "cue": "Flat, incline and decline lying presses in sequence.",
                "img": "ac0d43ac979f83d2.png"
              },
              {
                "n": 2,
                "name": "D Bar Pulley Pushdown",
                "cue": "D-bar handle, neutral wrist.",
                "img": "73611dc2859357ec.png"
              },
              {
                "n": 3,
                "name": "Wide Bar Overhead",
                "cue": "Wide grip overhead extension.",
                "img": "c54493420f57a7c7.png"
              },
              {
                "n": 4,
                "name": "Kick Back",
                "cue": "Upper arm parallel to the floor, only the elbow moves.",
                "img": "ff2d26cb20de4ce0.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Wings / Back / Biceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "D Bar Lat Pull Down Front",
                "cue": "D-bar handle, neutral grip.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 2,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 3,
                "name": "Reverse Butterfly",
                "cue": "Rear delts and mid-back — squeeze the blades.",
                "img": "c3e745c88311c247.png"
              },
              {
                "n": 4,
                "name": "Seated Lower Pull",
                "cue": "Chest tall, pull to the navel, squeeze the blades.",
                "img": "b0230db760ad3de3.png"
              }
            ]
          },
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Curl Superset (Plus)",
                "cue": "Ascending superset, no rest between.",
                "img": "801ec5362733929b.png"
              },
              {
                "n": 2,
                "name": "Preacher Curl",
                "cue": "Arms flat on the pad, don't fully lock out at the bottom.",
                "img": "005b7c31f05c3f53.png"
              },
              {
                "n": 3,
                "name": "Cable Curl (Rev)",
                "cue": "Overhand cable curl — forearms and brachialis.",
                "img": "48e85ff9a488133b.png"
              },
              {
                "n": 4,
                "name": "Onearm Dumbell Curl (Hold)",
                "cue": "Hold the peak contraction 2 seconds.",
                "img": "2858615a531b5b32.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Shoulder / Forearms",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Standing Press Smith",
                "cue": "Standing, core tight, no back arch.",
                "img": "268913769691f48e.png"
              },
              {
                "n": 2,
                "name": "Cross Dumbell Press",
                "cue": "Rotate the palms in and out as you press.",
                "img": "f93a3cf2f9371e5a.png"
              },
              {
                "n": 3,
                "name": "Side Lateral (One Arm)",
                "cue": "One arm at a time, hold the rack for balance.",
                "img": "fddb69682305f082.png"
              },
              {
                "n": 4,
                "name": "Shruggle",
                "cue": "Hold the top for a full second.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Reverse Barbell Curl",
                "cue": "Light weight — the forearms tire fast.",
                "img": "13cd9d0a202d965d.png"
              },
              {
                "n": 2,
                "name": "Dumbell Hammer Curl",
                "cue": "Neutral grip, no swinging.",
                "img": "615605a597057366.png"
              },
              {
                "n": 3,
                "name": "Reverse Cable Curl",
                "cue": "Constant tension on the forearms.",
                "img": "48e85ff9a488133b.png"
              },
              {
                "n": 4,
                "name": "Wrist Curl",
                "cue": "Forearms on the thighs, palms up, curl the wrists.",
                "img": "470deaa3adcf4765.png"
              }
            ]
          }
        ]
      },
      {
        "n": 4,
        "focus": "Legs",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Front Squats",
                "cue": "Elbows high, upright torso, quad-dominant.",
                "img": "511490a42c65a560.png"
              },
              {
                "n": 2,
                "name": "Dumbell Lunges",
                "cue": "Long step, back knee to just off the floor.",
                "img": "82875bd7948016ee.png"
              },
              {
                "n": 3,
                "name": "Leg Press",
                "cue": "Feet mid-platform, don't lock the knees out hard.",
                "img": "fe4c89790a6ac63e.png"
              },
              {
                "n": 4,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 7,
    "title": "Schedule 7",
    "subtitle": "15 x 3 reps × sets   ·   4 training days   ·   30 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Triceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Bench Press (Rev)",
                "cue": "Reverse (underhand) grip — keep elbows tucked.",
                "img": "96c84c26183465f6.png"
              },
              {
                "n": 2,
                "name": "Decline Dumbell Fly",
                "cue": "Lower-chest stretch, squeeze at the top.",
                "img": "4b55100d8cb65266.png"
              },
              {
                "n": 3,
                "name": "Free Weight",
                "cue": "Free-weight cable work — steady tempo both ways.",
                "img": "4f5740dd8e4e275b.png"
              },
              {
                "n": 4,
                "name": "Pullover",
                "cue": "Hips low, big stretch over the head, ribcage expands.",
                "img": "5b955a0a7b7f57f7.png"
              }
            ]
          },
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Z Bar French Press (+)",
                "cue": "EZ bar, adding weight each set.",
                "img": "6d693faa3938847a.png"
              },
              {
                "n": 2,
                "name": "Pulley Pushdown (W C)",
                "cue": "Wide cable grip variation.",
                "img": "73611dc2859357ec.png"
              },
              {
                "n": 3,
                "name": "Dumbell Extension",
                "cue": "Elbows tight to the head, full stretch behind.",
                "img": "432b1b21c1f322a8.png"
              },
              {
                "n": 4,
                "name": "Kick Back",
                "cue": "Upper arm parallel to the floor, only the elbow moves.",
                "img": "ff2d26cb20de4ce0.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Wings / Back / Biceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "Lat Pull Down Front",
                "cue": "Chest up, lead with the elbows not the hands.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 2,
                "name": "D Bar Rowing",
                "cue": "D-handle row, elbow drives past the torso.",
                "img": "56dde8049b870598.png"
              },
              {
                "n": 3,
                "name": "Lat Pulldown Back",
                "cue": "Bar to the base of the neck, don't force it.",
                "img": "263e4e1c5ae4a030.png"
              },
              {
                "n": 4,
                "name": "Seated Lower Pull",
                "cue": "Chest tall, pull to the navel, squeeze the blades.",
                "img": "b0230db760ad3de3.png"
              }
            ]
          },
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Preacher Curl",
                "cue": "Arms flat on the pad, don't fully lock out at the bottom.",
                "img": "005b7c31f05c3f53.png"
              },
              {
                "n": 2,
                "name": "Cable Curl (W C)",
                "cue": "Wide cable grip.",
                "img": "356b78e958b6383a.png"
              },
              {
                "n": 3,
                "name": "Hammer Concentration",
                "cue": "Seated, neutral grip, elbow braced on the thigh.",
                "img": "62dddffaf34acdca.png"
              },
              {
                "n": 4,
                "name": "Barbell Curl",
                "cue": "Elbows glued to the sides, no hip swing.",
                "img": "801ec5362733929b.png"
              },
              {
                "n": 5,
                "name": "Dumbell Curl",
                "cue": "Supinate as you curl — turn the pinky up.",
                "img": "2858615a531b5b32.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Shoulder / Forearms",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Smith Press Back",
                "cue": "Behind the neck on the Smith, light weight.",
                "img": "268913769691f48e.png"
              },
              {
                "n": 2,
                "name": "Side Lateral Raise",
                "cue": "Lead with the elbows, pinkies slightly high.",
                "img": "b781dfd732479df7.png"
              },
              {
                "n": 3,
                "name": "Dumbell Press (H)",
                "cue": "Hammer (neutral) grip press.",
                "img": "5b1757d1d6bbc48c.png"
              },
              {
                "n": 4,
                "name": "Shruggle",
                "cue": "Hold the top for a full second.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Reverse Barbell Curl",
                "cue": "Light weight — the forearms tire fast.",
                "img": "13cd9d0a202d965d.png"
              },
              {
                "n": 2,
                "name": "Dumbell Hammer Curl",
                "cue": "Neutral grip, no swinging.",
                "img": "615605a597057366.png"
              },
              {
                "n": 3,
                "name": "Reverse Cable Curl",
                "cue": "Constant tension on the forearms.",
                "img": "48e85ff9a488133b.png"
              },
              {
                "n": 4,
                "name": "Wrist Curl",
                "cue": "Forearms on the thighs, palms up, curl the wrists.",
                "img": "470deaa3adcf4765.png"
              }
            ]
          }
        ]
      },
      {
        "n": 4,
        "focus": "Legs",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Front Squats",
                "cue": "Elbows high, upright torso, quad-dominant.",
                "img": "511490a42c65a560.png"
              },
              {
                "n": 2,
                "name": "Dumbell Lunges",
                "cue": "Long step, back knee to just off the floor.",
                "img": "82875bd7948016ee.png"
              },
              {
                "n": 3,
                "name": "Leg Press",
                "cue": "Feet mid-platform, don't lock the knees out hard.",
                "img": "fe4c89790a6ac63e.png"
              },
              {
                "n": 4,
                "name": "Leg Curl",
                "cue": "Hips down on the pad, curl the heels to the glutes.",
                "img": "086ab15078d42cfb.png"
              },
              {
                "n": 5,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 8,
    "title": "Schedule 8",
    "subtitle": "15 x 3 reps × sets   ·   4 training days   ·   28 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Legs",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Bench Press (Inc) Dumbell Bench Press",
                "cue": "Barbell incline, then straight into dumbbells.",
                "img": "993de78056b8d3b9.png"
              },
              {
                "n": 2,
                "name": "Pec Deck",
                "cue": "Slow return — resist the pads all the way back.",
                "img": "4f5740dd8e4e275b.png"
              },
              {
                "n": 3,
                "name": "Flat Bar Bench Press and Dumbell Fly",
                "cue": "Superset: press to failure, straight into flyes.",
                "img": "96c84c26183465f6.png"
              },
              {
                "n": 4,
                "name": "Pullover",
                "cue": "Hips low, big stretch over the head, ribcage expands.",
                "img": "5b955a0a7b7f57f7.png"
              }
            ]
          },
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Squats",
                "cue": "Chest up, knees tracking the toes, hips to parallel.",
                "img": "687f51d28b944606.png"
              },
              {
                "n": 2,
                "name": "Dumbell Lunges",
                "cue": "Long step, back knee to just off the floor.",
                "img": "82875bd7948016ee.png"
              },
              {
                "n": 3,
                "name": "Leg Extension",
                "cue": "Squeeze at full extension, slow negative.",
                "img": "e0774c1b20de42a9.png"
              },
              {
                "n": 4,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Biceps",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Curl (-)",
                "cue": "Drop set — strip weight, keep curling.",
                "img": "801ec5362733929b.png"
              },
              {
                "n": 2,
                "name": "Dumbell Curl Super Set (3 Part)",
                "cue": "Three grips back to back: standard, hammer, reverse.",
                "img": "2858615a531b5b32.png"
              },
              {
                "n": 3,
                "name": "Preacher Curl",
                "cue": "Arms flat on the pad, don't fully lock out at the bottom.",
                "img": "005b7c31f05c3f53.png"
              },
              {
                "n": 4,
                "name": "Concentration",
                "cue": "Elbow on the inner thigh, squeeze at the top.",
                "img": "62dddffaf34acdca.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Wings / Back / Shoulder",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "Lat Pulldown Back",
                "cue": "Bar to the base of the neck, don't force it.",
                "img": "263e4e1c5ae4a030.png"
              },
              {
                "n": 2,
                "name": "Spider Row (Bar)",
                "cue": "Barbell on the incline bench, row to the chest.",
                "img": "f05787bd352b7f0b.png"
              },
              {
                "n": 3,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 4,
                "name": "Reverse Latpulldown",
                "cue": "Palms facing you, full contraction.",
                "img": "ade028eeda5d0f88.png"
              }
            ]
          },
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Press Front",
                "cue": "Front press — keep the ribs down.",
                "img": "0a82929370f65ba9.png"
              },
              {
                "n": 2,
                "name": "Seated Dumbell Press Back",
                "cue": "Behind-the-head path, light and controlled.",
                "img": "5b1757d1d6bbc48c.png"
              },
              {
                "n": 3,
                "name": "Dumbell Front Raise",
                "cue": "Raise to eye level, thumbs slightly up.",
                "img": "b1b56fccf6670b33.png"
              },
              {
                "n": 4,
                "name": "Shruggle",
                "cue": "Hold the top for a full second.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          }
        ]
      },
      {
        "n": 4,
        "focus": "Triceps / Forearms",
        "reps": "15 x 3",
        "sections": [
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Close Grip Bar Press",
                "cue": "Hands shoulder-width, elbows tucked in tight.",
                "img": "4b58aed60969dca9.png"
              },
              {
                "n": 2,
                "name": "V Bar Overhead",
                "cue": "V-bar overhead, elbows tight.",
                "img": "c54493420f57a7c7.png"
              },
              {
                "n": 3,
                "name": "Pulley Pushdown",
                "cue": "Elbows pinned to the ribs, full squeeze at the bottom.",
                "img": "73611dc2859357ec.png"
              },
              {
                "n": 4,
                "name": "Bench Dips / Close Grip Pushups",
                "cue": "Dips to failure, then close-grip pushups.",
                "img": "065c6ea8dbb2ddb2.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Curl (Rev)",
                "cue": "Knuckles up, controlled tempo.",
                "img": "13cd9d0a202d965d.png"
              },
              {
                "n": 2,
                "name": "Dumbell Hammer Curl",
                "cue": "Neutral grip, no swinging.",
                "img": "615605a597057366.png"
              },
              {
                "n": 3,
                "name": "Cable Curl (Rev)",
                "cue": "Straight bar, knuckles up.",
                "img": "48e85ff9a488133b.png"
              },
              {
                "n": 4,
                "name": "Wrist Curl",
                "cue": "Forearms on the thighs, palms up, curl the wrists.",
                "img": "470deaa3adcf4765.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 9,
    "title": "Schedule 9",
    "subtitle": "10 x 3 reps × sets   ·   4 training days   ·   29 exercises   ·   Slow movements",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Legs",
        "reps": "10 x 3",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Flat Bench Press",
                "cue": "Feet planted, controlled descent, no bounce.",
                "img": "96c84c26183465f6.png"
              },
              {
                "n": 2,
                "name": "Dumbell Press (Inc)",
                "cue": "Slow eccentric, deep stretch at the bottom.",
                "img": "acbf3f5e1dd2c904.png"
              },
              {
                "n": 3,
                "name": "Dumbell Press (Dec) Seated",
                "cue": "Decline angle, lower-chest squeeze.",
                "img": "acbf3f5e1dd2c904.png"
              },
              {
                "n": 4,
                "name": "Pec Deck",
                "cue": "Slow return — resist the pads all the way back.",
                "img": "4f5740dd8e4e275b.png"
              }
            ]
          },
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Dumbell Lunges",
                "cue": "Long step, back knee to just off the floor.",
                "img": "82875bd7948016ee.png"
              },
              {
                "n": 2,
                "name": "Leg Press",
                "cue": "Feet mid-platform, don't lock the knees out hard.",
                "img": "fe4c89790a6ac63e.png"
              },
              {
                "n": 3,
                "name": "Leg Extension",
                "cue": "Squeeze at full extension, slow negative.",
                "img": "e0774c1b20de42a9.png"
              },
              {
                "n": 4,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Biceps / Forearms",
        "reps": "10 x 3",
        "sections": [
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Z Barbell Curl",
                "cue": "Angled grip, full range.",
                "img": "760267dfd5299c3d.png"
              },
              {
                "n": 2,
                "name": "Incline Dumbell Curl",
                "cue": "Slow negative, no swinging.",
                "img": "a54ac5061a0b5cac.png"
              },
              {
                "n": 3,
                "name": "Cable Curl (D Bar)",
                "cue": "D-bar attachment, elbows fixed.",
                "img": "356b78e958b6383a.png"
              },
              {
                "n": 4,
                "name": "One Arm Preacher Curl",
                "cue": "Single arm, strict, no bounce off the bottom.",
                "img": "005b7c31f05c3f53.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Dumbell Hammer Curl",
                "cue": "Neutral grip, no swinging.",
                "img": "615605a597057366.png"
              },
              {
                "n": 2,
                "name": "Back Wrist Curl",
                "cue": "Palms down — extensor side of the forearm.",
                "img": "d4023feab9310475.png"
              },
              {
                "n": 3,
                "name": "Cable Reverse Curl",
                "cue": "Overhand cable curl, elbows still.",
                "img": "48e85ff9a488133b.png"
              },
              {
                "n": 4,
                "name": "Wrist Curl",
                "cue": "Forearms on the thighs, palms up, curl the wrists.",
                "img": "470deaa3adcf4765.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Wings / Back / Shoulder",
        "reps": "10 x 3",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "Front Lat Pull Down",
                "cue": "Full stretch at the top, squeeze the lats down.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 2,
                "name": "Incline Independent Row",
                "cue": "Chest on the incline pad, no body english.",
                "img": "f05787bd352b7f0b.png"
              },
              {
                "n": 3,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 4,
                "name": "Seated Lower Pull",
                "cue": "Chest tall, pull to the navel, squeeze the blades.",
                "img": "b0230db760ad3de3.png"
              }
            ]
          },
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Smith Press Front",
                "cue": "Bar in front, press to lockout.",
                "img": "268913769691f48e.png"
              },
              {
                "n": 2,
                "name": "Dumbell Press",
                "cue": "Elbows slightly forward, full lockout.",
                "img": "5b1757d1d6bbc48c.png"
              },
              {
                "n": 3,
                "name": "Machine Upright Row",
                "cue": "Fixed path, elbows high.",
                "img": "214ee18562d104f6.png"
              },
              {
                "n": 4,
                "name": "Shrugs",
                "cue": "Heavy but honest — full range.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          }
        ]
      },
      {
        "n": 4,
        "focus": "Triceps",
        "reps": "10 x 3",
        "sections": [
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Z Bar Lying Curl",
                "cue": "EZ bar lying extension — elbows fixed.",
                "img": "ac0d43ac979f83d2.png"
              },
              {
                "n": 2,
                "name": "Z Bar Lying Press",
                "cue": "EZ bar close grip, lower to the forehead.",
                "img": "ac0d43ac979f83d2.png"
              },
              {
                "n": 3,
                "name": "Widebar Overhead",
                "cue": "Long-head stretch — lean into it.",
                "img": "c54493420f57a7c7.png"
              },
              {
                "n": 4,
                "name": "Widebar Pulley Pushdown",
                "cue": "Wide bar — outer head emphasis.",
                "img": "73611dc2859357ec.png"
              },
              {
                "n": 5,
                "name": "Bench Dips",
                "cue": "Hands on the bench behind, dip to 90°.",
                "img": "065c6ea8dbb2ddb2.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 10,
    "title": "Schedule 10",
    "subtitle": "12 x 3 reps × sets   ·   3 training days   ·   25 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Legs",
        "reps": "12 x 3",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Incline Chest Press",
                "cue": "Push through the heel of the palm.",
                "img": "993de78056b8d3b9.png"
              },
              {
                "n": 2,
                "name": "Dumbell Fly",
                "cue": "Soft elbow bend, hug the movement in.",
                "img": "4b55100d8cb65266.png"
              },
              {
                "n": 3,
                "name": "Decline Bar Bench Press",
                "cue": "Keep the bar path over the lower pecs.",
                "img": "62ef2fb91eef2586.png"
              },
              {
                "n": 4,
                "name": "Barbell Pullover",
                "cue": "Keep the elbows narrow, stretch the lats and chest.",
                "img": "5b955a0a7b7f57f7.png"
              }
            ]
          },
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Squats",
                "cue": "Chest up, knees tracking the toes, hips to parallel.",
                "img": "687f51d28b944606.png"
              },
              {
                "n": 2,
                "name": "Dumbell Lunges",
                "cue": "Long step, back knee to just off the floor.",
                "img": "82875bd7948016ee.png"
              },
              {
                "n": 3,
                "name": "Leg Extension",
                "cue": "Squeeze at full extension, slow negative.",
                "img": "e0774c1b20de42a9.png"
              },
              {
                "n": 4,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Biceps / Forearms",
        "reps": "12 x 3",
        "sections": [
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Chinups + Barbell Curl",
                "cue": "Chins to failure, straight into barbell curls.",
                "img": "21a4d8402d8588f8.png"
              },
              {
                "n": 2,
                "name": "Hammer Curl",
                "cue": "Neutral grip — thumbs up the whole way.",
                "img": "615605a597057366.png"
              },
              {
                "n": 3,
                "name": "Spider Biceps Curl",
                "cue": "Chest on the incline — arms hang straight down.",
                "img": "a54ac5061a0b5cac.png"
              },
              {
                "n": 4,
                "name": "Barbell Curl (Rev)",
                "cue": "Overhand grip — hits the brachialis.",
                "img": "13cd9d0a202d965d.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Curl Rev (-)",
                "cue": "Drop set, reverse grip.",
                "img": "13cd9d0a202d965d.png"
              },
              {
                "n": 2,
                "name": "Hammer Curl",
                "cue": "Thumbs up throughout.",
                "img": "615605a597057366.png"
              },
              {
                "n": 3,
                "name": "Back Wrist Curl",
                "cue": "Palms down — extensor side of the forearm.",
                "img": "d4023feab9310475.png"
              },
              {
                "n": 4,
                "name": "Wrist Curl",
                "cue": "Forearms on the thighs, palms up, curl the wrists.",
                "img": "470deaa3adcf4765.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Shoulder / Legs",
        "reps": "12 x 3",
        "sections": [
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Smith Press Back",
                "cue": "Behind the neck on the Smith, light weight.",
                "img": "268913769691f48e.png"
              },
              {
                "n": 2,
                "name": "Upright Row",
                "cue": "Bar close to the body, elbows lead above the wrists.",
                "img": "bb0c5bb34e592f48.png"
              },
              {
                "n": 3,
                "name": "Dumbell Press (H)",
                "cue": "Hammer (neutral) grip press.",
                "img": "5b1757d1d6bbc48c.png"
              },
              {
                "n": 4,
                "name": "Shruggle",
                "cue": "Hold the top for a full second.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          },
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Machine Squat",
                "cue": "Back flat on the pad, full range.",
                "img": "fe4c89790a6ac63e.png"
              },
              {
                "n": 2,
                "name": "Leg Press",
                "cue": "Feet mid-platform, don't lock the knees out hard.",
                "img": "fe4c89790a6ac63e.png"
              },
              {
                "n": 3,
                "name": "Leg Curl",
                "cue": "Hips down on the pad, curl the heels to the glutes.",
                "img": "086ab15078d42cfb.png"
              },
              {
                "n": 4,
                "name": "Leg Extension",
                "cue": "Squeeze at full extension, slow negative.",
                "img": "e0774c1b20de42a9.png"
              },
              {
                "n": 5,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 12,
    "title": "Schedule 12",
    "subtitle": "12 x 4 reps × sets   ·   4 training days   ·   28 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Triceps",
        "reps": "12 x 4",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Flat Dumbell Fly",
                "cue": "Control the stretch — this is the whole exercise.",
                "img": "4b55100d8cb65266.png"
              },
              {
                "n": 2,
                "name": "Barbell Press (Dec)",
                "cue": "Lower-chest emphasis, full lockout.",
                "img": "62ef2fb91eef2586.png"
              },
              {
                "n": 3,
                "name": "Cable Crossover",
                "cue": "Slight forward lean, cross the hands at the bottom.",
                "img": "4f5740dd8e4e275b.png"
              },
              {
                "n": 4,
                "name": "Seated Chest Press",
                "cue": "Handles at mid-chest height.",
                "img": "db7df4e88a5c42c8.png"
              }
            ]
          },
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Z Bar Close Grip",
                "cue": "EZ bar close grip press.",
                "img": "4b58aed60969dca9.png"
              },
              {
                "n": 2,
                "name": "Pulley Pushdown",
                "cue": "Elbows pinned to the ribs, full squeeze at the bottom.",
                "img": "73611dc2859357ec.png"
              },
              {
                "n": 3,
                "name": "Seated Dumbell Extension",
                "cue": "Seated and braced — no torso swing.",
                "img": "432b1b21c1f322a8.png"
              },
              {
                "n": 4,
                "name": "Kickback Twist",
                "cue": "Rotate the palm up at lockout.",
                "img": "ff2d26cb20de4ce0.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Wings / Back / Biceps",
        "reps": "12 x 4",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 2,
                "name": "Lat Pulldown (Rev)",
                "cue": "Underhand grip — more biceps and lower lats.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 3,
                "name": "Seated Lowerpull",
                "cue": "Don't round the back on the return.",
                "img": "b0230db760ad3de3.png"
              },
              {
                "n": 4,
                "name": "Deadlift",
                "cue": "Neutral spine, bar close to the shins, drive the floor away.",
                "img": "56dde8049b870598.png"
              }
            ]
          },
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Z Bar Curl (Close)",
                "cue": "Close grip — outer biceps head.",
                "img": "760267dfd5299c3d.png"
              },
              {
                "n": 2,
                "name": "D Bar Upper Curl",
                "cue": "High cable curl with the D-bar.",
                "img": "356b78e958b6383a.png"
              },
              {
                "n": 3,
                "name": "Preacher Curl",
                "cue": "Arms flat on the pad, don't fully lock out at the bottom.",
                "img": "005b7c31f05c3f53.png"
              },
              {
                "n": 4,
                "name": "D Bar Concentration",
                "cue": "D-handle concentration curl.",
                "img": "62dddffaf34acdca.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Shoulder / Forearms",
        "reps": "12 x 4",
        "sections": [
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Smith Press Back",
                "cue": "Behind the neck on the Smith, light weight.",
                "img": "268913769691f48e.png"
              },
              {
                "n": 2,
                "name": "Lateral Bentover",
                "cue": "Hinge over, raise wide, squeeze the rear delts.",
                "img": "c3e745c88311c247.png"
              },
              {
                "n": 3,
                "name": "Cable Upright Row",
                "cue": "Constant tension, pull to the collarbone.",
                "img": "214ee18562d104f6.png"
              },
              {
                "n": 4,
                "name": "Shruggle",
                "cue": "Hold the top for a full second.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Reverse Curl",
                "cue": "Overhand grip, wrists locked straight.",
                "img": "13cd9d0a202d965d.png"
              },
              {
                "n": 2,
                "name": "Dumbell Hammer Curl",
                "cue": "Neutral grip, no swinging.",
                "img": "615605a597057366.png"
              },
              {
                "n": 3,
                "name": "Back Wrist Curl",
                "cue": "Palms down — extensor side of the forearm.",
                "img": "d4023feab9310475.png"
              },
              {
                "n": 4,
                "name": "Wrist Curl",
                "cue": "Forearms on the thighs, palms up, curl the wrists.",
                "img": "470deaa3adcf4765.png"
              }
            ]
          }
        ]
      },
      {
        "n": 4,
        "focus": "Legs",
        "reps": "12 x 4",
        "sections": [
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Front Squats",
                "cue": "Elbows high, upright torso, quad-dominant.",
                "img": "511490a42c65a560.png"
              },
              {
                "n": 2,
                "name": "Barbell Lunges",
                "cue": "Torso upright, alternate legs.",
                "img": "82875bd7948016ee.png"
              },
              {
                "n": 3,
                "name": "Leg Press",
                "cue": "Feet mid-platform, don't lock the knees out hard.",
                "img": "fe4c89790a6ac63e.png"
              },
              {
                "n": 4,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 13,
    "title": "Schedule 13",
    "subtitle": "10 x 3 reps × sets   ·   3 training days   ·   24 exercises   ·   Total minus",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Triceps",
        "reps": "10 x 3",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Press",
                "cue": "Wrists stacked over elbows, full lockout.",
                "img": "96c84c26183465f6.png"
              },
              {
                "n": 2,
                "name": "Barbell Press (Dec)",
                "cue": "Lower-chest emphasis, full lockout.",
                "img": "62ef2fb91eef2586.png"
              },
              {
                "n": 3,
                "name": "Flat Dumbell Press",
                "cue": "Deep stretch, squeeze at the top.",
                "img": "3cf3443167a3d569.png"
              },
              {
                "n": 4,
                "name": "Pec Deck with Pushups",
                "cue": "Finish each set with pushups to failure.",
                "img": "4f5740dd8e4e275b.png"
              }
            ]
          },
          {
            "name": "TRICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Skull Crusher (Machine)",
                "cue": "Machine path — elbows locked in place.",
                "img": "5523efa2846ecdf1.png"
              },
              {
                "n": 2,
                "name": "Pulley Pushdown (Minus)",
                "cue": "Descending weight each set, keep the reps.",
                "img": "73611dc2859357ec.png"
              },
              {
                "n": 3,
                "name": "Seated Dumbell Extension",
                "cue": "Seated and braced — no torso swing.",
                "img": "432b1b21c1f322a8.png"
              },
              {
                "n": 4,
                "name": "Kickback",
                "cue": "Squeeze and hold at full extension.",
                "img": "ff2d26cb20de4ce0.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Wings / Back / Biceps",
        "reps": "10 x 3",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "Lat Pulldown",
                "cue": "No swinging — the lats move the bar.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 2,
                "name": "T Bar Pull",
                "cue": "Hinge at the hips, chest proud.",
                "img": "56dde8049b870598.png"
              },
              {
                "n": 3,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 4,
                "name": "Seated Lowerpull",
                "cue": "Don't round the back on the return.",
                "img": "b0230db760ad3de3.png"
              }
            ]
          },
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Barbell Curl",
                "cue": "Elbows glued to the sides, no hip swing.",
                "img": "801ec5362733929b.png"
              },
              {
                "n": 2,
                "name": "Dumbell Curl",
                "cue": "Supinate as you curl — turn the pinky up.",
                "img": "2858615a531b5b32.png"
              },
              {
                "n": 3,
                "name": "Cable Curl",
                "cue": "Constant tension — cables never let the biceps rest.",
                "img": "356b78e958b6383a.png"
              },
              {
                "n": 4,
                "name": "Preacher Curl",
                "cue": "Arms flat on the pad, don't fully lock out at the bottom.",
                "img": "005b7c31f05c3f53.png"
              }
            ]
          }
        ]
      },
      {
        "n": 3,
        "focus": "Shoulder / Legs",
        "reps": "10 x 3",
        "sections": [
          {
            "name": "SHOULDER",
            "exercises": [
              {
                "n": 1,
                "name": "Smith Press",
                "cue": "Fixed bar path — good for pushing heavier safely.",
                "img": "268913769691f48e.png"
              },
              {
                "n": 2,
                "name": "Upright Row",
                "cue": "Bar close to the body, elbows lead above the wrists.",
                "img": "bb0c5bb34e592f48.png"
              },
              {
                "n": 3,
                "name": "Side Lateral",
                "cue": "Stop at shoulder height — no higher.",
                "img": "b781dfd732479df7.png"
              },
              {
                "n": 4,
                "name": "Shruggle Smith",
                "cue": "Smith bar shrugs, pause at the top.",
                "img": "dda4d225ec97bf53.png"
              }
            ]
          },
          {
            "name": "LEGS",
            "exercises": [
              {
                "n": 1,
                "name": "Smith Squat",
                "cue": "Feet slightly forward, controlled depth.",
                "img": "687f51d28b944606.png"
              },
              {
                "n": 2,
                "name": "Leg Press",
                "cue": "Feet mid-platform, don't lock the knees out hard.",
                "img": "fe4c89790a6ac63e.png"
              },
              {
                "n": 3,
                "name": "Leg Extension",
                "cue": "Squeeze at full extension, slow negative.",
                "img": "e0774c1b20de42a9.png"
              },
              {
                "n": 4,
                "name": "Calf Raise",
                "cue": "Full stretch at the bottom, high on the toes at the top.",
                "img": "469db3b3275e5a64.png"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 14,
    "title": "Schedule 14",
    "subtitle": "12 x 5 reps × sets   ·   2 training days   ·   20 exercises",
    "days": [
      {
        "n": 1,
        "focus": "Chest / Biceps",
        "reps": "12 x 5",
        "sections": [
          {
            "name": "CHEST",
            "exercises": [
              {
                "n": 1,
                "name": "Cable Crossover",
                "cue": "Slight forward lean, cross the hands at the bottom.",
                "img": "4f5740dd8e4e275b.png"
              },
              {
                "n": 2,
                "name": "Barbell Press",
                "cue": "Wrists stacked over elbows, full lockout.",
                "img": "96c84c26183465f6.png"
              },
              {
                "n": 3,
                "name": "Inc Barbell Press",
                "cue": "Upper-chest focus, don't flare the elbows.",
                "img": "993de78056b8d3b9.png"
              },
              {
                "n": 4,
                "name": "Flat Fly",
                "cue": "Keep the elbow angle fixed throughout.",
                "img": "4b55100d8cb65266.png"
              },
              {
                "n": 5,
                "name": "Parallel Bar Stretch",
                "cue": "Hold the bottom stretch, chest open.",
                "img": "c801e195ca8ff3aa.png"
              },
              {
                "n": 6,
                "name": "Pullover",
                "cue": "Hips low, big stretch over the head, ribcage expands.",
                "img": "5b955a0a7b7f57f7.png"
              }
            ]
          },
          {
            "name": "BICEPS",
            "exercises": [
              {
                "n": 1,
                "name": "Preacher Curl",
                "cue": "Arms flat on the pad, don't fully lock out at the bottom.",
                "img": "005b7c31f05c3f53.png"
              },
              {
                "n": 2,
                "name": "Barbell Curl",
                "cue": "Elbows glued to the sides, no hip swing.",
                "img": "801ec5362733929b.png"
              },
              {
                "n": 3,
                "name": "Dumbell Curl",
                "cue": "Supinate as you curl — turn the pinky up.",
                "img": "2858615a531b5b32.png"
              },
              {
                "n": 4,
                "name": "Cable Upper Curl",
                "cue": "High pulleys, double-biceps squeeze at the top.",
                "img": "356b78e958b6383a.png"
              },
              {
                "n": 5,
                "name": "Hammer Curl",
                "cue": "Neutral grip — thumbs up the whole way.",
                "img": "615605a597057366.png"
              },
              {
                "n": 6,
                "name": "Barbell Curl (Rev)",
                "cue": "Overhand grip — hits the brachialis.",
                "img": "13cd9d0a202d965d.png"
              }
            ]
          }
        ]
      },
      {
        "n": 2,
        "focus": "Wings / Back / Forearms",
        "reps": "12 x 5",
        "sections": [
          {
            "name": "WINGS / BACK",
            "exercises": [
              {
                "n": 1,
                "name": "T Bar Pull",
                "cue": "Hinge at the hips, chest proud.",
                "img": "56dde8049b870598.png"
              },
              {
                "n": 2,
                "name": "Dumbell Rowing",
                "cue": "Knee and hand on the bench, row to the hip.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 3,
                "name": "Independent Row",
                "cue": "One side at a time — even both sides out.",
                "img": "8e261de1d673da0f.png"
              },
              {
                "n": 4,
                "name": "Lat Pulldown",
                "cue": "No swinging — the lats move the bar.",
                "img": "ade028eeda5d0f88.png"
              },
              {
                "n": 5,
                "name": "Seated Lowerpull",
                "cue": "Don't round the back on the return.",
                "img": "b0230db760ad3de3.png"
              }
            ]
          },
          {
            "name": "FOREARMS",
            "exercises": [
              {
                "n": 1,
                "name": "Hammer Curl",
                "cue": "Thumbs up throughout.",
                "img": "615605a597057366.png"
              },
              {
                "n": 2,
                "name": "Cable Curl (Rev)",
                "cue": "Straight bar, knuckles up.",
                "img": "48e85ff9a488133b.png"
              },
              {
                "n": 3,
                "name": "Wrist Curl",
                "cue": "Forearms on the thighs, palms up, curl the wrists.",
                "img": "470deaa3adcf4765.png"
              }
            ]
          }
        ]
      }
    ]
  }
];
