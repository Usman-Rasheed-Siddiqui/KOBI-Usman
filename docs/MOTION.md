# Motion System

KOBI treats motion as state communication rather than decoration.

## Principles

- immediate input feedback
- spring-based settling rather than slow cinematic easing
- spatial origin/destination when a relationship exists
- closing is slightly faster than opening
- transitions remain interruptible
- compositor-friendly transforms/opacity dominate continuous motion
- no animation may block primary actions

## Components

- `MotionDialog`: focus-managed, Escape-aware, origin-aware modal with restrained spring choreography.
- `GenieTransition`: a web-safe Genie-inspired deformation/minimize effect using clip-path + GPU transforms, with a simple reduced-motion path.
- `AnimatePresence` + layout motion: progressive live-result insertion/removal without page flashes.
- Skeletons: geometry-preserving cards/profile/search surfaces.

A browser app cannot literally use Apple's Core Animation framework. The implementation borrows the interaction principles—layers, springs, continuity and physical origin—using web-native animation primitives.

## Reduced motion

Motion components consult `prefers-reduced-motion`. Large spatial/deformation effects resolve to restrained opacity/state transitions while functionality and focus behavior remain unchanged.
