# Android

Two separate apps share one library:

- `core/` shared code (owner: Naol; every change reviewed by Naol and Barkot)
- `passenger/` the passenger app (Naol)
- `driver/` the driver app (Barkot)

Kotlin with Jetpack Compose, Android Studio. The apps depend on `core` only, never on each other. See `docs/CONTRACT.md` Section 14.
