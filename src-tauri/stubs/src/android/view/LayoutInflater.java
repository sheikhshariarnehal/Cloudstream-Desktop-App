package android.view;

import android.content.Context;

public class LayoutInflater {
    private final Context context;

    public LayoutInflater(Context context) {
        this.context = context;
    }

    public static LayoutInflater from(Context context) {
        return new LayoutInflater(context);
    }

    public View inflate(int resource, ViewGroup root) {
        return inflate(resource, root, root != null);
    }

    public View inflate(int resource, ViewGroup root, boolean attachToRoot) {
        return new View(context);
    }
}
