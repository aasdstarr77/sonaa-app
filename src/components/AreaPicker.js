import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import { filterAreaOptions, isReservedAreaLabel } from '../utils/area-helpers';

export default function AreaPicker({ label, options = [], value, onChange, multiple = false, maxSelections = 30, inputRef }) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(multiple || !value);
  const selected = multiple
    ? (Array.isArray(value) ? value.filter(area => !isReservedAreaLabel(area)) : [])
    : (value && !isReservedAreaLabel(value) ? [value] : []);
  const filtered = useMemo(() => filterAreaOptions(options, query), [options, query]);

  const toggleArea = area => {
    if (!multiple) {
      onChange?.(area);
      setQuery('');
      setShowResults(false);
      return;
    }
    const exists = selected.includes(area);
    if (exists) onChange?.(selected.filter(item => item !== area));
    else if (selected.length < maxSelections) onChange?.([...selected, area]);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {multiple && selected.length ? (
        <View style={styles.chips}>
          {selected.map(area => (
            <TouchableOpacity key={area} accessibilityRole="button" accessibilityLabel={'إزالة ' + area}
              onPress={() => toggleArea(area)} style={styles.chip}>
              <Text style={styles.chipText}>{area}  ×</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {!multiple && selected.length ? (
        <View style={styles.selectedSingle}>
          <Text style={styles.selectedText}>{selected[0]}</Text>
          <TouchableOpacity onPress={() => { onChange?.(''); setShowResults(true); }}><Text style={styles.changeText}>تغيير</Text></TouchableOpacity>
        </View>
      ) : null}
      <TextInput
        ref={inputRef}
        value={query}
        onChangeText={value => { setQuery(value); setShowResults(true); }}
        onFocus={() => setShowResults(true)}
        placeholder="ابحث عن المنطقة أو الحي"
        placeholderTextColor={COLORS.placeholder}
        style={styles.search}
        textAlign="right"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="البحث عن منطقة"
      />
      {showResults ? (
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.results} contentContainerStyle={styles.resultsContent}>
          {filtered.length ? filtered.map(area => {
            const active = selected.includes(area);
            const limitReached = multiple && !active && selected.length >= maxSelections;
            return (
              <TouchableOpacity key={area} disabled={limitReached} onPress={() => toggleArea(area)}
                accessibilityRole={multiple ? 'checkbox' : 'button'}
                accessibilityState={{ checked: active, disabled: limitReached }}
                style={[styles.option, active && styles.optionActive, limitReached && styles.optionDisabled]}>
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{area}</Text>
                <Text style={[styles.check, active && styles.checkActive]}>{active ? '✓' : multiple ? '＋' : 'اختيار'}</Text>
              </TouchableOpacity>
            );
          }) : <Text style={styles.empty}>لا توجد مناطق مطابقة للبحث.</Text>}
        </ScrollView>
      ) : null}
      {multiple ? <Text style={styles.hint}>تم اختيار {selected.length} من {maxSelections} منطقة كحد أقصى.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12, gap: 8 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  search: { minHeight: 46, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 13, color: COLORS.text, backgroundColor: COLORS.white, fontSize: 13, fontWeight: '700' },
  results: { maxHeight: 218, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.white },
  resultsContent: { padding: 6 },
  option: { minHeight: 42, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  optionActive: { backgroundColor: COLORS.cyan50 },
  optionDisabled: { opacity: 0.35 },
  optionText: { flex: 1, color: COLORS.text, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  optionTextActive: { color: COLORS.tealDark, fontWeight: '900' },
  check: { color: COLORS.muted, minWidth: 35, textAlign: 'left', fontSize: 12, fontWeight: '900' },
  checkActive: { color: COLORS.tealDark },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: COLORS.cyan50, borderWidth: 1, borderColor: COLORS.cyan300, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { color: COLORS.tealDark, fontSize: 11, fontWeight: '800' },
  selectedSingle: { minHeight: 42, borderRadius: 10, backgroundColor: COLORS.cyan50, borderWidth: 1, borderColor: COLORS.cyan300, paddingHorizontal: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  selectedText: { color: COLORS.tealDark, fontWeight: '900', fontSize: 12 },
  changeText: { color: COLORS.indigo700, fontSize: 11, fontWeight: '900' },
  empty: { padding: 14, color: COLORS.muted, textAlign: 'center', fontSize: 12 },
  hint: { color: COLORS.muted, textAlign: 'right', fontSize: 10, fontWeight: '700' },
});
