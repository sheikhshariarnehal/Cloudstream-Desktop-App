package androidx.fragment.app;

import android.app.Activity;
import android.content.Context;
import android.content.res.Resources;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

public class Fragment {
    private Context context;
    private View view;

    public Fragment() {}

    public Context getContext() { return context != null ? context : new Context(); }
    public Context requireContext() { return getContext(); }
    public Activity getActivity() { return new Activity(); }
    public Activity requireActivity() { return getActivity(); }
    public Resources getResources() { return getContext().getResources(); }
    public String getString(int resId) { return ""; }
    public String getString(int resId, Object... formatArgs) { return ""; }
    public View getView() { return view != null ? view : new View(getContext()); }

    public void onCreate(Bundle savedInstanceState) {}
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        this.view = new View(getContext());
        return this.view;
    }
    public void onViewCreated(View view, Bundle savedInstanceState) {}
    public void onDestroyView() {}
    public void onDestroy() {}
}
