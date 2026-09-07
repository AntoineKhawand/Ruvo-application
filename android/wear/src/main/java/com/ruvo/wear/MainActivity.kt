package com.ruvo.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.CreationExtras
import androidx.wear.compose.material.MaterialTheme

class MainActivity : ComponentActivity() {

    private val viewModel: RunCompanionViewModel by viewModels {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
                RunCompanionViewModel(PhoneConnection(applicationContext)) as T
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                RunCompanionScreen(viewModel)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        viewModel.startListening()
    }

    override fun onStop() {
        viewModel.stopListening()
        super.onStop()
    }
}
