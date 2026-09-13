package android.content;

/**
 * Stub android.content.Context for desktop JVM compatibility.
 */
public class Context {
    public Context() {}
    public Object getSystemService(String name) { return null; }
    public String getPackageName() { return "com.lagradost.cloudstream3"; }
    public Object getApplicationContext() { return this; }
    public Object getResources() { return null; }
    public Object getContentResolver() { return null; }
    public Object getFilesDir() { return null; }
    public Object getCacheDir() { return null; }
    public Object getSharedPreferences(String name, int mode) { return null; }
    public boolean bindService(Object intent, Object conn, int flags) { return false; }
    public void unbindService(Object conn) {}
    public void startActivity(Object intent) {}
    public Object startService(Object intent) { return null; }
}
