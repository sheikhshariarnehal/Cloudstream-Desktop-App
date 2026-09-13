package androidx.appcompat.app;

/**
 * Stub implementation of AppCompatActivity for desktop JVM compatibility.
 * Android plugins that reference this class will not crash on desktop.
 */
public class AppCompatActivity {
    public AppCompatActivity() {}
    public void setContentView(Object view) {}
    public void finish() {}
    public Object getSystemService(String name) { return null; }
    public android.content.Context getApplicationContext() { return null; }
    public Object getWindow() { return null; }
    public void runOnUiThread(Runnable action) { if (action != null) action.run(); }
    public void onDestroy() {}
    public void onCreate(Object savedInstanceState) {}
    public void onResume() {}
    public void onPause() {}
    public void onStop() {}
    public void onStart() {}
    public Object getSupportActionBar() { return null; }
    public Object getIntent() { return null; }
}
