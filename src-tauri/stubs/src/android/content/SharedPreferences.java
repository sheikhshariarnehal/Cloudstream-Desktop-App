package android.content;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public interface SharedPreferences {
    interface Editor {
        Editor putString(String key, String value);
        Editor putStringSet(String key, Set<String> values);
        Editor putInt(String key, int value);
        Editor putLong(String key, long value);
        Editor putFloat(String key, float value);
        Editor putBoolean(String key, boolean value);
        Editor remove(String key);
        Editor clear();
        boolean commit();
        void apply();
    }

    Map<String, ?> getAll();
    String getString(String key, String defValue);
    Set<String> getStringSet(String key, Set<String> defValues);
    int getInt(String key, int defValue);
    long getLong(String key, long defValue);
    float getFloat(String key, float defValue);
    boolean getBoolean(String key, boolean defValue);
    boolean contains(String key);
    Editor edit();

    class InMemory implements SharedPreferences {
        private final ConcurrentHashMap<String, Object> map = new ConcurrentHashMap<>();

        @Override
        public Map<String, ?> getAll() { return map; }

        @Override
        public String getString(String key, String defValue) {
            Object v = map.get(key);
            return v instanceof String ? (String) v : defValue;
        }

        @Override
        @SuppressWarnings("unchecked")
        public Set<String> getStringSet(String key, Set<String> defValues) {
            Object v = map.get(key);
            return v instanceof Set ? (Set<String>) v : defValues;
        }

        @Override
        public int getInt(String key, int defValue) {
            Object v = map.get(key);
            return v instanceof Number ? ((Number) v).intValue() : defValue;
        }

        @Override
        public long getLong(String key, long defValue) {
            Object v = map.get(key);
            return v instanceof Number ? ((Number) v).longValue() : defValue;
        }

        @Override
        public float getFloat(String key, float defValue) {
            Object v = map.get(key);
            return v instanceof Number ? ((Number) v).floatValue() : defValue;
        }

        @Override
        public boolean getBoolean(String key, boolean defValue) {
            Object v = map.get(key);
            return v instanceof Boolean ? (Boolean) v : defValue;
        }

        @Override
        public boolean contains(String key) { return map.containsKey(key); }

        @Override
        public Editor edit() {
            return new Editor() {
                private final ConcurrentHashMap<String, Object> temp = new ConcurrentHashMap<>();
                private boolean clearFlag = false;

                @Override public Editor putString(String key, String value) { temp.put(key, value != null ? value : ""); return this; }
                @Override public Editor putStringSet(String key, Set<String> values) { if (values != null) temp.put(key, values); return this; }
                @Override public Editor putInt(String key, int value) { temp.put(key, value); return this; }
                @Override public Editor putLong(String key, long value) { temp.put(key, value); return this; }
                @Override public Editor putFloat(String key, float value) { temp.put(key, value); return this; }
                @Override public Editor putBoolean(String key, boolean value) { temp.put(key, value); return this; }
                @Override public Editor remove(String key) { temp.remove(key); map.remove(key); return this; }
                @Override public Editor clear() { clearFlag = true; temp.clear(); return this; }
                @Override public boolean commit() { apply(); return true; }
                @Override public void apply() {
                    if (clearFlag) map.clear();
                    map.putAll(temp);
                }
            };
        }
    }
}
