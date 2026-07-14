package com.ruvo.app.features.paywall

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.revenuecat.purchases.*
import com.revenuecat.purchases.models.StoreProduct
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PaywallPackage(
    val identifier: String,
    val title: String,
    val priceString: String,
    val badge: String?,
    val storePackage: Package?,
)

data class PaywallUiState(
    val packages: List<PaywallPackage> = emptyList(),
    val selectedPackageId: String = "annual",
    val isLoading: Boolean = false,
    val isPurchased: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class PaywallViewModel @Inject constructor() : ViewModel() {

    private val _uiState = MutableStateFlow(PaywallUiState())
    val uiState: StateFlow<PaywallUiState> = _uiState.asStateFlow()

    fun loadOfferings() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            try {
                Purchases.sharedInstance.getOfferingsWith(
                    onError = { error ->
                        _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = error.message)
                    },
                    onSuccess = { offerings ->
                        val current = offerings.current ?: return@getOfferingsWith
                        val packages = current.availablePackages.map { pkg ->
                            val isAnnual = pkg.packageType == PackageType.ANNUAL
                            PaywallPackage(
                                identifier = pkg.identifier,
                                title = when (pkg.packageType) {
                                    PackageType.ANNUAL  -> "Annual"
                                    PackageType.MONTHLY -> "Monthly"
                                    PackageType.WEEKLY  -> "Weekly"
                                    else -> pkg.identifier
                                },
                                priceString = pkg.product.price.formatted,
                                badge = if (isAnnual) "Save 60%" else null,
                                storePackage = pkg,
                            )
                        }.sortedByDescending { it.badge != null }
                        _uiState.value = _uiState.value.copy(
                            packages = packages,
                            selectedPackageId = packages.firstOrNull()?.identifier ?: "annual",
                            isLoading = false,
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun selectPackage(identifier: String) {
        _uiState.value = _uiState.value.copy(selectedPackageId = identifier)
    }

    fun selectFallback(identifier: String) {
        _uiState.value = _uiState.value.copy(selectedPackageId = identifier)
    }

    fun purchase(activity: Activity) {
        val selectedPkg = _uiState.value.packages.firstOrNull { it.identifier == _uiState.value.selectedPackageId }
        val storePackage = selectedPkg?.storePackage ?: run {
            _uiState.value = _uiState.value.copy(errorMessage = "Connect RevenueCat to enable purchases.")
            return
        }
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        Purchases.sharedInstance.purchaseWith(
            purchaseParams = PurchaseParams.Builder(activity, storePackage).build(),
            onError = { error, userCancelled ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = if (userCancelled) null else error.message
                )
            },
            onSuccess = { _, customerInfo ->
                val isPro = customerInfo.entitlements["pro"]?.isActive == true
                _uiState.value = _uiState.value.copy(isLoading = false, isPurchased = isPro)
            }
        )
    }

    fun restorePurchases() {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        Purchases.sharedInstance.restorePurchasesWith(
            onError = { error ->
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = error.message)
            },
            onSuccess = { customerInfo ->
                val isPro = customerInfo.entitlements["pro"]?.isActive == true
                _uiState.value = _uiState.value.copy(isLoading = false, isPurchased = isPro)
            }
        )
    }
}
