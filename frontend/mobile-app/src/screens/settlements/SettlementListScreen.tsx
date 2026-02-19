import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchSettlements } from '../../store/slices/settlementSlice';

export const SettlementListScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const { settlements } = useAppSelector(s => s.settlement);
  
  useEffect(() => { dispatch(fetchSettlements()); }, []);
  
  return (
    <View style={{flex:1,backgroundColor:'#f5f5f5'}}>
      <View style={{backgroundColor:'#667eea',padding:20}}>
        <Text style={{fontSize:14,color:'#fff',marginBottom:5}}>Pending Settlement</Text>
        <Text style={{fontSize:32,fontWeight:'bold',color:'#fff'}}>$1,234.56</Text>
      </View>
      <FlatList
        data={settlements}
        keyExtractor={i => i.id}
        renderItem={({item}) => (
          <TouchableOpacity style={{backgroundColor:'#fff',padding:15,marginHorizontal:15,marginVertical:8,borderRadius:10}} onPress={() => navigation.navigate('SettlementDetail', {id:item.id})}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
              <Text style={{fontSize:16,fontWeight:'600'}}>Batch #{item.batchId}</Text>
              <Text style={{fontSize:16,fontWeight:'bold',color:'#10b981'}}>${item.amount}</Text>
            </View>
            <Text style={{fontSize:14,color:'#666',marginBottom:8}}>Method: {item.method}</Text>
            <View style={{paddingHorizontal:10,paddingVertical:4,borderRadius:12,backgroundColor:'#fef3c7',alignSelf:'flex-start'}}>
              <Text style={{fontSize:11,fontWeight:'600'}}>{item.status}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={{position:'absolute',right:20,bottom:20,width:60,height:60,borderRadius:30,backgroundColor:'#667eea',justifyContent:'center',alignItems:'center'}} onPress={() => navigation.navigate('SettlementRequest')}>
        <Text style={{fontSize:32,color:'#fff'}}>+</Text>
      </TouchableOpacity>
    </View>
  );
};