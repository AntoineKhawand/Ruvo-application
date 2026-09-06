package com.ruvo.app.features.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PasswordStrengthTest {

    @Test
    fun `valid password passes every rule`() {
        val rules = checkPasswordRules("RuvoTest9!")
        assertTrue(rules.minLength)
        assertTrue(rules.hasUpper)
        assertTrue(rules.hasLower)
        assertTrue(rules.hasNumber)
        assertTrue(rules.hasSymbol)
        assertTrue(rules.notCommon)
        assertTrue(rules.allPass)
        assertTrue(isPasswordValid("RuvoTest9!"))
    }

    @Test
    fun `too short fails minLength only`() {
        val rules = checkPasswordRules("Ab1!fgh") // 7 chars
        assertFalse(rules.minLength)
        assertTrue(rules.hasUpper)
        assertTrue(rules.hasLower)
        assertTrue(rules.hasNumber)
        assertTrue(rules.hasSymbol)
        assertFalse(isPasswordValid("Ab1!fgh"))
    }

    @Test
    fun `missing uppercase fails hasUpper only`() {
        val rules = checkPasswordRules("ruvotest9!")
        assertFalse(rules.hasUpper)
        assertTrue(rules.minLength)
        assertTrue(rules.hasLower)
        assertTrue(rules.hasNumber)
        assertTrue(rules.hasSymbol)
        assertFalse(isPasswordValid("ruvotest9!"))
    }

    @Test
    fun `missing lowercase fails hasLower only`() {
        val rules = checkPasswordRules("RUVOTEST9!")
        assertFalse(rules.hasLower)
        assertFalse(isPasswordValid("RUVOTEST9!"))
    }

    @Test
    fun `missing number fails hasNumber only`() {
        val rules = checkPasswordRules("RuvoTestX!")
        assertFalse(rules.hasNumber)
        assertFalse(isPasswordValid("RuvoTestX!"))
    }

    @Test
    fun `missing symbol fails hasSymbol only`() {
        val rules = checkPasswordRules("RuvoTest9X")
        assertFalse(rules.hasSymbol)
        assertFalse(isPasswordValid("RuvoTest9X"))
    }

    @Test
    fun `known common password fails notCommon even though every other rule passes`() {
        // Deliberately picks one from PasswordStrength.kt's own COMMON_PASSWORDS
        // list — every individual character-class rule passes for this string,
        // only the denylist should fail it.
        val rules = checkPasswordRules("Password1!")
        assertTrue(rules.minLength)
        assertTrue(rules.hasUpper)
        assertTrue(rules.hasLower)
        assertTrue(rules.hasNumber)
        assertTrue(rules.hasSymbol)
        assertFalse(rules.notCommon)
        assertFalse(isPasswordValid("Password1!"))
    }

    @Test
    fun `empty password fails every rule except notCommon`() {
        val rules = checkPasswordRules("")
        assertFalse(rules.minLength)
        assertFalse(rules.hasUpper)
        assertFalse(rules.hasLower)
        assertFalse(rules.hasNumber)
        assertFalse(rules.hasSymbol)
        assertTrue(rules.notCommon)
        assertFalse(isPasswordValid(""))
    }
}
