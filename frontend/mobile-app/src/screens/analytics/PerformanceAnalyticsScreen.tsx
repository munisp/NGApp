import React, { useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchAnalytics } from '../../store/slices/analyticsSlice';

export const PerformanceAnalyticsScreen = () => {
  const dispatch = useAppDispatch();
  const { data } = useAppSelector(s => s.analytics);
  
  useEffect(() => { dispatch(fetchAnalytics('month')); }, []);
  
  if (!data) return null;
  
  return (
    <ScrollView style={{flex:1,backgroundColor:'#f5f5f5',padding:20}}>
      <Text style={{fontSize:24,fontWeight:'bold',marginBottom:20}}>Performance Analytics</Text>
      
      <View style={{backgroundColor:'#fff',padding:20,borderRadius:10,marginBottom:15}}>
        <Text style={{fontSize:14,color:'#666',marginBottom:5}}>Total Revenue</Text>
        <Text style={{fontSize:32,fontWeight:'bold',color:'#10b981'}}>${data.totalRevenue}</Text>
        <Text style={{fontSize:12,color:'#10b981',marginTop:5}}>↑ {data.revenueGrowth}% from last month</Text>
      </View>
      
      <View style={{backgroundColor:'#fff',padding:20,borderRadius:10,marginBottom:15}}>
        <Text style={{fontSize:14,color:'#666',marginBottom:5}}>Total Transactions</Text>
        <Text style={{fontSize:32,fontWeight:'bold'}}>{data.totalTransactions}</Text>
        <Text style={{fontSize:12,color:'#10b981',marginTop:5}}>↑ {data.transactionGrowth}% from last month</Text>
      </View>
      
      <View style={{backgroundColor:'#fff',padding:20,borderRadius:10}}>
        <Text style={{fontSize:14,color:'#666',marginBottom:5}}>Total Commission</Text>
        <Text style={{fontSize:32,fontWeight:'bold',color:'#667eea'}}>${data.totalCommission}</Text>
      </View>
    </ScrollView>
  );
};