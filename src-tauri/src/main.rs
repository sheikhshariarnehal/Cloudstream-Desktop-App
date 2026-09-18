// Prevents additional console window on Windows — always active (dev + release).
// Previously gated behind `not(debug_assertions)`, which caused a second CMD
// terminal to appear every time `tauri dev` launched the exe.
#![windows_subsystem = "windows"]

fn main() {
    cloudstream_desktop_lib::run()
}
