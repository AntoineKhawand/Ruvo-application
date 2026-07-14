package com.ruvo.app.features.weather

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ruvo.app.designsystem.components.RuvoCard
import com.ruvo.app.designsystem.theme.RuvoColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class WeatherWidgetState(
    val advice: RunWeatherAdvice? = null,
    val isLoading: Boolean = false,
)

@HiltViewModel
class WeatherViewModel @Inject constructor(
    private val weatherService: WeatherService,
) : ViewModel() {

    private val _state = MutableStateFlow(WeatherWidgetState())
    val state: StateFlow<WeatherWidgetState> = _state.asStateFlow()

    fun load() {
        if (_state.value.advice != null) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            val weather = weatherService.fetchCurrentWeather()
            _state.value = if (weather != null) {
                _state.value.copy(advice = weatherService.buildAdvice(weather), isLoading = false)
            } else {
                _state.value.copy(isLoading = false)
            }
        }
    }
}

@Composable
fun WeatherWidget(viewModel: WeatherViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.load() }

    when {
        state.isLoading -> {
            Box(
                Modifier.fillMaxWidth().height(80.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(RuvoColors.surface),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator(color = RuvoColors.lime, modifier = Modifier.size(24.dp)) }
        }
        state.advice != null -> {
            val a = state.advice!!
            RuvoCard(isHighlighted = a.isGoodForRun) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(a.emoji, style = MaterialTheme.typography.titleLarge)
                            Column {
                                Text(a.condition, style = MaterialTheme.typography.titleSmall, color = RuvoColors.textPrimary)
                                Text(a.temperature, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                            }
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(if (a.isGoodForRun) RuvoColors.limeDim else Color(0x33EF4444))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                if (a.isGoodForRun) "Great for running" else "Caution",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (a.isGoodForRun) RuvoColors.lime else Color(0xFFEF4444),
                            )
                        }
                    }
                    Text(a.recommendation, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                    if (a.tipTitle.isNotBlank()) {
                        Divider(color = RuvoColors.border)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("💡", style = MaterialTheme.typography.bodySmall)
                            Column {
                                Text(a.tipTitle, style = MaterialTheme.typography.labelSmall, color = RuvoColors.lime)
                                Text(a.tip, style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
                            }
                        }
                    }
                }
            }
        }
    }
}
