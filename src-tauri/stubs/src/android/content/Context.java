package android.content;

import android.content.res.Resources;
import java.io.File;

/**
 * Stub android.content.Context for desktop JVM compatibility.
 * Provides exact binary signatures expected by CloudStream plugins.
 */
public class Context {
    public static int $stable = 8;
    private static final SharedPreferences SHARED_PREFS = new SharedPreferences.InMemory();
    private static final Resources RESOURCES = new Resources();

    public Context() {}

    public Context getApplicationContext() {
        return this;
    }

    public String getPackageName() {
        return "com.lagradost.cloudstream3";
    }

    public Resources getResources() {
        return RESOURCES;
    }

    public String getString(int id) {
        return "";
    }

    public String getString(int id, Object... formatArgs) {
        return "";
    }

    public SharedPreferences getSharedPreferences(String name, int mode) {
        return SHARED_PREFS;
    }

    public Object getSystemService(String name) {
        return null;
    }

    public Object getContentResolver() {
        return null;
    }

    public File getFilesDir() {
        String home = System.getProperty("user.home");
        File dir = new File(home != null ? home : ".", ".cloudstream_desktop/files");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    public File getCacheDir() {
        String home = System.getProperty("user.home");
        File dir = new File(home != null ? home : ".", ".cloudstream_desktop/cache");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    public boolean bindService(Object intent, Object conn, int flags) {
        return false;
    }

    public void unbindService(Object conn) {}

    public void startActivity(Object intent) {}

    public Object startService(Object intent) {
        return null;
    }
}
