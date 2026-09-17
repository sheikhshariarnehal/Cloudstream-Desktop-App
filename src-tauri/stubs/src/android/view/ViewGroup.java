package android.view;

import android.content.Context;

public class ViewGroup extends View {
    public ViewGroup() {}
    public ViewGroup(Context context) { super(context); }
    public void addView(View child) {}
    public void removeView(View child) {}
    public int getChildCount() { return 0; }
    public View getChildAt(int index) { return null; }
}
