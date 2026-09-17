package androidx.fragment.app;

import android.app.Dialog;
import android.os.Bundle;

public class DialogFragment extends Fragment {
    private Dialog dialog;

    public DialogFragment() {}

    public Dialog getDialog() {
        if (dialog == null) dialog = new Dialog(getContext());
        return dialog;
    }

    public Dialog onCreateDialog(Bundle savedInstanceState) {
        return getDialog();
    }

    public void show(FragmentManager manager, String tag) {}
    public int show(FragmentTransaction transaction, String tag) { return 0; }
    public void dismiss() {
        if (dialog != null) dialog.dismiss();
    }
    public void dismissAllowingStateLoss() {
        dismiss();
    }
    public void setCancelable(boolean cancelable) {}
    public boolean isCancelable() { return true; }
}
