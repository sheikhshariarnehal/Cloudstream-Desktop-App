use std::env;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let manifest_path = Path::new(&manifest_dir);
    let lib_dir = manifest_path.join("libmpv");

    // Auto-extract libmpv if missing (from bundled libmpv-2_x64.zip)
    let dll_path = lib_dir.join("libmpv-2.dll");
    let zip_path = manifest_path.join("libmpv-2_x64.zip");
    if !dll_path.exists() && zip_path.exists() {
        if let Ok(archive) = fs::read(&zip_path) {
            let _ = zip_extract::extract(Cursor::new(archive), &lib_dir, true);
        }
    }

    // Ensure libmpv-2.dll exists at manifest root for bundle packaging
    let root_dll = manifest_path.join("libmpv-2.dll");
    if dll_path.exists() && !root_dll.exists() {
        let _ = fs::copy(&dll_path, &root_dll);
    }

    tauri_build::build();

    println!("cargo:rustc-link-search=native={}", lib_dir.display());
    println!("cargo:rustc-link-arg=/LIBPATH:{}", lib_dir.display());

    // Copy libmpv-2.dll, engine.jar, and android-stubs.jar to target directory so dev runs find them
    if let Ok(out_dir) = env::var("OUT_DIR") {
        let out_path = PathBuf::from(out_dir);
        if let Some(target_dir) = out_path.ancestors().nth(3) {
            let src_dll = lib_dir.join("libmpv-2.dll");
            let dst_dll = target_dir.join("libmpv-2.dll");
            if src_dll.exists() && !dst_dll.exists() {
                let _ = fs::copy(&src_dll, &dst_dll);
            }
            let src_engine = manifest_path.join("engine.jar");
            let dst_engine = target_dir.join("engine.jar");
            if src_engine.exists() && !dst_engine.exists() {
                let _ = fs::copy(&src_engine, &dst_engine);
            }
            let src_stubs = manifest_path.join("android-stubs.jar");
            let dst_stubs = target_dir.join("android-stubs.jar");
            if src_stubs.exists() && !dst_stubs.exists() {
                let _ = fs::copy(&src_stubs, &dst_stubs);
            }
        }
    }
}
