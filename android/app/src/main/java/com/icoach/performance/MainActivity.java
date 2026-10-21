package com.icoach.performance;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Draw under the status and navigation bars on every Android version (Android 15+ always
        // does). The SystemBars plugin and the page's env(safe-area-inset-*) padding keep content
        // clear of them. Capacitor 9 will make this call itself.
        EdgeToEdge.enable(this);
    }
}
