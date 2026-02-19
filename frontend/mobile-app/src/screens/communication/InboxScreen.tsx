import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchMessages } from '../../store/slices/communicationSlice';

export const InboxScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const { messages, unreadCount } = useAppSelector(s => s.communication);
  
  useEffect(() => { dispatch(fetchMessages()); }, []);
  
  return (
    <View style={{flex:1,backgroundColor:'#f5f5f5'}}>
      {unreadCount > 0 && (
        <View style={{backgroundColor:'#667eea',padding:15}}>
          <Text style={{color:'#fff',fontSize:14}}>You have {unreadCount} unread messages</Text>
        </View>
      )}
      <FlatList
        data={messages}
        keyExtractor={i => i.id}
        renderItem={({item}) => (
          <TouchableOpacity style={{backgroundColor:'#fff',padding:15,marginHorizontal:15,marginVertical:8,borderRadius:10}} onPress={() => navigation.navigate('MessageDetail', {id:item.id})}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
              <Text style={{fontSize:16,fontWeight:'600'}}>{item.subject || 'No Subject'}</Text>
              {item.status !== 'read' && <View style={{width:8,height:8,borderRadius:4,backgroundColor:'#667eea'}} />}
            </View>
            <Text style={{fontSize:14,color:'#666',numberOfLines:2}}>{item.content}</Text>
            <Text style={{fontSize:12,color:'#999',marginTop:8}}>{item.type} • {new Date(item.sentAt).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};