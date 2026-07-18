export const durations = { instant: .08, micro: .14, quick: .2, standard: .32, expressive: .48 } as const;
export const springs = {
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: .72 },
  modal: { type: "spring", stiffness: 390, damping: 35, mass: .86 },
  soft: { type: "spring", stiffness: 260, damping: 30, mass: 1 },
  sheet: { type: "spring", stiffness: 420, damping: 38, mass: .9 }
} as const;
