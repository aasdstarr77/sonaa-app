import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
class StartupErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Sonaa startup render error:', error, info?.componentStack); }
  render() {
    if (this.state.error) {
      return <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7FF', padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#172554', textAlign: 'right', marginBottom: 12 }}>تعذر تشغيل شاشة صُنّاع</Text>
        <Text selectable style={{ color: '#B91C1C', textAlign: 'left', marginBottom: 20 }}>{String(this.state.error?.message || this.state.error)}</Text>
        <TouchableOpacity onPress={() => this.setState({ error: null })} style={{ backgroundColor: '#172554', padding: 14, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>إعادة المحاولة</Text></TouchableOpacity>
      </SafeAreaView>;
    }
    return this.props.children;
  }
}
export default StartupErrorBoundary;
