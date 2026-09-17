package android.app;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;

public class Activity extends Context {
    public static int $stable = 8;
    public Activity() {}

    public LayoutInflater getLayoutInflater() {
        return LayoutInflater.from(this);
    }

    public void setContentView(int layoutResID) {}
    public void setContentView(View view) {}
    public View findViewById(int id) { return new View(this); }
    public void finish() {}
    public boolean isFinishing() { return false; }
    public boolean isDestroyed() { return false; }
    public void runOnUiThread(Runnable action) {
        if (action != null) action.run();
    }
}
