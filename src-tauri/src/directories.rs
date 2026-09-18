use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppDirectoryInfo {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub path: String,
    pub exists: bool,
    pub file_count: usize,
    pub total_bytes: u64,
    pub formatted_size: String,
    pub can_browse: bool,
    pub can_clear: bool,
    pub can_open: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheClearResult {
    pub freed_bytes: u64,
    pub formatted_freed: String,
    pub deleted_count: usize,
    pub message: String,
}

/// Recursively computes directory size and file count
pub fn get_dir_size_and_count(path: &Path) -> (u64, usize) {
    if !path.exists() {
        return (0, 0);
    }
    if path.is_file() {
        return path.metadata().map(|m| (m.len(), 1)).unwrap_or((0, 0));
    }

    let mut total_size = 0u64;
    let mut file_count = 0usize;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    total_size += meta.len();
                    file_count += 1;
                } else if meta.is_dir() {
                    let (sub_size, sub_count) = get_dir_size_and_count(&entry.path());
                    total_size += sub_size;
                    file_count += sub_count;
                }
            }
        }
    }

    (total_size, file_count)
}

/// Formats raw byte count into human-readable representation
pub fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Resolves user download directory
pub fn resolve_download_dir(custom_path: Option<&str>) -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    if let Some(p) = custom_path {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if path.is_absolute() {
                return path;
            } else {
                return home.join(path);
            }
        }
    }

    home.join("Downloads").join("CloudStream")
}

/// Launches the OS file manager for the given file or directory
pub fn open_path_in_explorer(target_path: &str) -> Result<(), String> {
    let path = PathBuf::from(target_path);

    if !path.exists() {
        if path.extension().is_some() {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
        } else {
            let _ = fs::create_dir_all(&path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if path.is_file() {
            Command::new("explorer")
                .arg(format!("/select,\"{}\"", path.to_string_lossy()))
                .spawn()
                .map_err(|e| format!("Failed to open Explorer: {}", e))?;
        } else {
            Command::new("explorer")
                .arg(path.to_string_lossy().to_string())
                .spawn()
                .map_err(|e| format!("Failed to open Explorer: {}", e))?;
        }
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(path.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(path.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
        Ok(())
    }
}

/// Opens native Windows FolderBrowserDialog in a blocking worker thread
pub async fn pick_folder(initial_dir: Option<String>) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            let initial = initial_dir.unwrap_or_default().replace('\'', "''");
            let ps_script = format!(
                r#"Add-Type -AssemblyName System.Windows.Forms;
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;
$dialog.Description = 'Select CloudStream Storage Directory';
$dialog.ShowNewFolderButton = $true;
if ('{}' -ne '') {{ $dialog.SelectedPath = '{}' }};
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
    Write-Output $dialog.SelectedPath
}}"#,
                initial, initial
            );

            let mut cmd = Command::new("powershell");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }
            let output = cmd.output()
                .map_err(|e| format!("Failed to launch folder picker: {}", e))?;

            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !stdout.is_empty() {
                    return Ok(Some(stdout));
                }
            }
            Ok(None)
        }

        #[cfg(not(target_os = "windows"))]
        {
            Ok(None)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Clears files inside a directory and returns freed metrics
pub fn clear_dir_contents(path: &Path) -> (u64, usize) {
    if !path.exists() || !path.is_dir() {
        return (0, 0);
    }

    let mut freed_bytes = 0u64;
    let mut deleted_count = 0usize;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if let Ok(meta) = p.metadata() {
                if meta.is_file() {
                    freed_bytes += meta.len();
                    if fs::remove_file(&p).is_ok() {
                        deleted_count += 1;
                    }
                } else if meta.is_dir() {
                    let (sub_freed, sub_count) = clear_dir_contents(&p);
                    freed_bytes += sub_freed;
                    deleted_count += sub_count;
                    let _ = fs::remove_dir(&p);
                }
            }
        }
    }

    (freed_bytes, deleted_count)
}
