package androidx.fragment.app;

public class FragmentTransaction {
    public FragmentTransaction add(Fragment fragment, String tag) { return this; }
    public FragmentTransaction add(int containerViewId, Fragment fragment) { return this; }
    public FragmentTransaction replace(int containerViewId, Fragment fragment) { return this; }
    public FragmentTransaction remove(Fragment fragment) { return this; }
    public int commit() { return 0; }
    public int commitAllowingStateLoss() { return 0; }
}
