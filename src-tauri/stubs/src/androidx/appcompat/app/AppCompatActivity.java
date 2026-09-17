package androidx.appcompat.app;

import android.app.Activity;
import android.content.Context;
import androidx.fragment.app.FragmentManager;

/**
 * Stub implementation of AppCompatActivity for desktop JVM compatibility.
 * Android plugins that reference this class will not crash on desktop.
 */
public class AppCompatActivity extends Activity {
    public static int $stable = 8;
    private final FragmentManager fragmentManager = new FragmentManager();

    public AppCompatActivity() {}
    public void setContentView(Object view) {}
    public void finish() {}
    public Object getSystemService(String name) { return null; }
    public Context getApplicationContext() { return this; }
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
    public FragmentManager getSupportFragmentManager() { return fragmentManager; }
}
