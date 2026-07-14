package com.ruvo.app

import android.content.Context
import android.util.Log
import com.scottyab.rootbeer.RootBeer
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SecurityManager @Inject constructor() {

    var isRooted = false
        private set

    fun runChecks(context: Context) {
        val rootBeer = RootBeer(context)
        isRooted = rootBeer.isRooted

        if (isRooted) {
            Log.w("SecurityManager", "Root detected — logging but not blocking (App Check handles enforcement)")
        }

        checkDebugger()
    }

    private fun checkDebugger() {
        if (android.os.Debug.isDebuggerConnected()) {
            Log.w("SecurityManager", "Debugger attached")
        }
    }
}
