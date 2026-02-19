import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchKYCStatus } from '../../store/slices/kycSlice';

export const KYCScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const { kycStatus, documents } = useAppSelector(s => s.kyc);
  
  useEffect(() => { dispatch(fetchKYCStatus()); }, []);
  
  return (
    <ScrollView style={{flex:1,backgroundColor:'#f5f5f5',padding:20}}>
      <Text style={{fontSize:24,fontWeight:'bold',marginBottom:20}}>KYC Verification</Text>
      
      <View style={{backgroundColor:'#fff',padding:20,borderRadius:10,marginBottom:20}}>
        <Text style={{fontSize:16,marginBottom:10}}>Status: <Text style={{fontWeight:'bold',color:kycStatus==='verified'?'#10b981':'#f59e0b'}}>{kycStatus}</Text></Text>
        <Text style={{fontSize:14,color:'#666'}}>Documents uploaded: {documents.length}</Text>
      </View>
      
      {kycStatus !== 'verified' && (
        <TouchableOpacity style={{backgroundColor:'#667eea',padding:15,borderRadius:8}} onPress={() => navigation.navigate('DocumentUpload')}>
          <Text style={{color:'#fff',fontSize:16,fontWeight:'600',textAlign:'center'}}>Upload Documents</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};