package android.view;

import android.content.Context;

public class View {
    private Context context;

    public View() {}
    public View(Context context) { this.context = context; }

    public Context getContext() { return context != null ? context : new Context(); }
    public View findViewById(int id) { return this; }
    public void setVisibility(int visibility) {}
    public int getVisibility() { return 0; }
    public void setOnClickListener(Object l) {}
}
