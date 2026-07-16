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

enum class PaywallPeriod { Annual, Monthly, Other }

data class PaywallPackage(
    val identifier: String,
    val title: String,
    val priceString: String,
    val priceAmount: Double,
    val period: PaywallPeriod,
    val badge: String?,
    val storePackage: Package?,
)

data class PaywallUiState(
    val packages: List<PaywallPackage> = emptyList(),
    val selectedPackageId: String = "annual",
    val isLoading: Boolean = false,
    val isPurchased: Boolean = false,
    val isMockOfferings: Boolean = false,
    val errorMessage: String? = null,
) {
    val annualPkg: PaywallPackage? get() = packages.find { it.period == PaywallPeriod.Annual }
    val monthlyPkg: PaywallPackage? get() = packages.find { it.period == PaywallPeriod.Monthly }
    val savingsPercent: Int? get() {
        val annual = annualPkg ?: return null
        val monthly = monthlyPkg ?: return null
        val yearlyIfMonthly = monthly.priceAmount * 12
        if (yearlyIfMonthly <= 0) return null
        return ((yearlyIfMonthly - annual.priceAmount) / yearlyIfMonthly * 100).toInt()
    }
}

@HiltViewModel
class PaywallViewModel @Inject constructor() : ViewModel() {

    private val _uiState = MutableStateFlow(PaywallUiState())
    val uiState: StateFlow<PaywallUiState> = _uiState.asStateFlow()

    fun loadOfferings() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            try {
                Purchases.sharedInstance.getOfferingsWith(
                    onError = {
                        _uiState.value = _uiState.value.copy(isLoading = false, packages = mockPackages(), isMockOfferings = true, selectedPackageId = "annual_test")
                    },
                    onSuccess = { offerings ->
                        val current = offerings.current
                        // Treat as real only if packages exist AND have a verified (non-zero) price —
                        // RevenueCat can return packages with a $0 price when the Play Store product
                        // isn't active yet, which should still be treated as "not live".
                        val hasVerifiedPrices = current?.availablePackages?.any { it.product.price.amountMicros > 0 } == true
                        if (current != null && hasVerifiedPrices) {
                            val packages = current.availablePackages.map { pkg ->
                                val period = when (pkg.packageType) {
                                    PackageType.ANNUAL  -> PaywallPeriod.Annual
                                    PackageType.MONTHLY -> PaywallPeriod.Monthly
                                    else -> PaywallPeriod.Other
                                }
                                PaywallPackage(
                                    identifier = pkg.identifier,
                                    title = when (period) {
                                        PaywallPeriod.Annual  -> "Annual Plan"
                                        PaywallPeriod.Monthly -> "Monthly Plan"
                                        PaywallPeriod.Other   -> pkg.identifier
                                    },
                                    priceString = pkg.product.price.formatted,
                                    priceAmount = pkg.product.price.amountMicros / 1_000_000.0,
                                    period = period,
                                    badge = null,
                                    storePackage = pkg,
                                )
                            }
                            val annualId = packages.find { it.period == PaywallPeriod.Annual }?.identifier
                            _uiState.value = _uiState.value.copy(
                                packages = packages,
                                isMockOfferings = false,
                                selectedPackageId = annualId ?: packages.firstOrNull()?.identifier ?: "annual",
                                isLoading = false,
                            )
                        } else {
                            _uiState.value = _uiState.value.copy(isLoading = false, packages = mockPackages(), isMockOfferings = true, selectedPackageId = "annual_test")
                        }
                    }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, packages = mockPackages(), isMockOfferings = true, selectedPackageId = "annual_test")
            }
        }
    }

    private fun mockPackages() = listOf(
        PaywallPackage(identifier = "annual_test", title = "Annual Plan", priceString = "$39.99", priceAmount = 39.99, period = PaywallPeriod.Annual, badge = null, storePackage = null),
        PaywallPackage(identifier = "monthly_test", title = "Monthly Plan", priceString = "$4.99", priceAmount = 4.99, period = PaywallPeriod.Monthly, badge = null, storePackage = null),
    )

    fun selectPackage(identifier: String) {
        _uiState.value = _uiState.value.copy(selectedPackageId = identifier)
    }

    fun purchase(activity: Activity) {
        val selectedPkg = _uiState.value.packages.firstOrNull { it.identifier == _uiState.value.selectedPackageId }
        val storePackage = selectedPkg?.storePackage ?: run {
            _uiState.value = _uiState.value.copy(errorMessage = "Purchases aren't live yet — products are still being configured in the Play Store.")
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
