import React, { useEffect } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchPayments } from '../../store/slices/paymentSlice';

export const PaymentHistoryScreen = () => {
  const dispatch = useAppDispatch();
  const { payments } = useAppSelector(s => s.payment);
  
  useEffect(() => { dispatch(fetchPayments()); }, []);
  
  return (
    <View style={{flex:1,backgroundColor:'#f5f5f5'}}>
      <FlatList
        data={payments}
        keyExtractor={i => i.id}
        renderItem={({item}) => (
          <View style={{backgroundColor:'#fff',padding:15,marginHorizontal:15,marginVertical:8,borderRadius:10}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
              <Text style={{fontSize:16,fontWeight:'600'}}>{item.method}</Text>
              <Text style={{fontSize:16,fontWeight:'bold',color:'#10b981'}}>${item.amount}</Text>
            </View>
            <Text style={{fontSize:12,color:'#999'}}>{item.reference}</Text>
            <View style={{marginTop:8,paddingHorizontal:10,paddingVertical:4,borderRadius:12,backgroundColor:'#d1fae5',alignSelf:'flex-start'}}>
              <Text style={{fontSize:11,fontWeight:'600'}}>{item.status}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
};