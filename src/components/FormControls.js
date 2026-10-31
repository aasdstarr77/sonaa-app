import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { styles } from '../theme/styles';
import { COLORS } from '../theme/colors';
function Button({ title, onPress, secondary = false, danger = false, disabled = false }) {
  return <TouchableOpacity disabled={disabled} onPress={onPress} activeOpacity={0.85} style={[styles.button, danger ? styles.buttonDanger : secondary ? styles.buttonSecondary : styles.buttonPrimary, disabled && styles.disabledButton]}>
    <Text style={[styles.buttonText, danger ? styles.buttonDangerText : secondary ? styles.buttonSecondaryText : styles.buttonPrimaryText]}>{title}</Text>
  </TouchableOpacity>;
}
function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = 'default', multiline = false, autoCapitalize = 'none', returnKeyType = 'default', returnKeyLabel, onSubmitEditing, blurOnSubmit = false, inputRef }) {
  return <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput ref={inputRef} value={value} onChangeText={onChangeText} placeholder={placeholder || label} placeholderTextColor={COLORS.placeholder}
      secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={autoCapitalize}
      multiline={multiline} returnKeyType={returnKeyType} returnKeyLabel={returnKeyLabel} onSubmitEditing={onSubmitEditing} blurOnSubmit={blurOnSubmit} textAlign="right" style={[styles.input, multiline && styles.multiline]} />
  </View>;
}
export { Button, Field };
