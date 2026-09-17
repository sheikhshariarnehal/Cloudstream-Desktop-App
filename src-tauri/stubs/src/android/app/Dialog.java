package android.app;

import android.content.Context;
import android.view.View;

public class Dialog {
    private final Context context;

    public Dialog(Context context) {
        this.context = context;
    }

    public Context getContext() { return context != null ? context : new Context(); }
    public void show() {}
    public void dismiss() {}
    public void cancel() {}
    public boolean isShowing() { return false; }
    public void setContentView(View view) {}
    public void setContentView(int layoutResID) {}
    public View findViewById(int id) { return new View(context); }
    public void setTitle(CharSequence title) {}
    public void setOnDismissListener(Object listener) {}
    public void setOnCancelListener(Object listener) {}
}
