import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Card, Chip, FAB, Portal, Modal } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';

interface MapLocation {
  id: string;
  type: 'agent' | 'hospital' | 'garage' | 'office';
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  rating?: number;
  distance?: number;
  services?: string[];
}

interface RiskZone {
  id: string;
  type: 'flood' | 'fire' | 'theft' | 'accident';
  center: { latitude: number; longitude: number };
  radius: number;
  riskLevel: 'low' | 'medium' | 'high';
}

const LOCATION_TYPES = [
  { id: 'agent', name: 'Agents', icon: 'account-tie', color: '#3b82f6' },
  { id: 'hospital', name: 'Hospitals', icon: 'hospital-building', color: '#ef4444' },
  { id: 'garage', name: 'Garages', icon: 'car-wrench', color: '#f59e0b' },
  { id: 'office', name: 'Offices', icon: 'office-building', color: '#10b981' },
];

const RISK_COLORS = {
  low: 'rgba(34, 197, 94, 0.3)',
  medium: 'rgba(245, 158, 11, 0.3)',
  high: 'rgba(239, 68, 68, 0.3)',
};

const MOCK_LOCATIONS: MapLocation[] = [
  { id: '1', type: 'agent', name: 'John Adeyemi', address: '15 Victoria Island, Lagos', latitude: 6.4281, longitude: 3.4219, phone: '+234 801 234 5678', rating: 4.8, distance: 1.2 },
  { id: '2', type: 'hospital', name: 'Reddington Hospital', address: '12 Idowu Martins, VI', latitude: 6.4320, longitude: 3.4180, phone: '+234 802 345 6789', rating: 4.5, distance: 2.5, services: ['Emergency', 'Surgery', 'Pharmacy'] },
  { id: '3', type: 'garage', name: 'AutoFix Nigeria', address: '45 Awolowo Road, Ikoyi', latitude: 6.4450, longitude: 3.4350, phone: '+234 803 456 7890', rating: 4.2, distance: 3.8, services: ['Repairs', 'Towing', 'Parts'] },
  { id: '4', type: 'office', name: 'InsurePortal HQ', address: '1 Ozumba Mbadiwe, VI', latitude: 6.4380, longitude: 3.4250, phone: '+234 800 123 4567', rating: 4.9, distance: 0.8 },
];

const MOCK_RISK_ZONES: RiskZone[] = [
  { id: '1', type: 'flood', center: { latitude: 6.4500, longitude: 3.4100 }, radius: 500, riskLevel: 'high' },
  { id: '2', type: 'accident', center: { latitude: 6.4350, longitude: 3.4300 }, radius: 300, riskLevel: 'medium' },
];

const { width, height } = Dimensions.get('window');

export default function GeospatialMapScreen({ navigation }: any) {
  const mapRef = useRef<MapView>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['agent', 'hospital', 'garage', 'office']);
  const [showRiskZones, setShowRiskZones] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { data: locations = MOCK_LOCATIONS } = useQuery({
    queryKey: ['map-locations'],
    queryFn: async () => {
      const response = await apiClient.get('/map/locations');
      return response.data;
    },
    placeholderData: MOCK_LOCATIONS,
  });

  const { data: riskZones = MOCK_RISK_ZONES } = useQuery({
    queryKey: ['risk-zones'],
    queryFn: async () => {
      const response = await apiClient.get('/map/risk-zones');
      return response.data;
    },
    placeholderData: MOCK_RISK_ZONES,
  });

  const filteredLocations = locations.filter((loc: MapLocation) => selectedTypes.includes(loc.type));

  const toggleLocationType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const getMarkerColor = (type: string) => {
    return LOCATION_TYPES.find(t => t.id === type)?.color || theme.colors.primary;
  };

  const handleMarkerPress = (location: MapLocation) => {
    setSelectedLocation(location);
    setModalVisible(true);
  };

  const centerOnUserLocation = () => {
    mapRef.current?.animateToRegion({
      latitude: 6.4281,
      longitude: 3.4219,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nearby Services</Text>
        <TouchableOpacity
          style={[styles.riskButton, showRiskZones && styles.riskButtonActive]}
          onPress={() => setShowRiskZones(!showRiskZones)}
        >
          <Icon name="alert-circle" size={24} color={showRiskZones ? '#fff' : theme.colors.warning} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        {LOCATION_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.filterChip,
              selectedTypes.includes(type.id) && { backgroundColor: type.color },
            ]}
            onPress={() => toggleLocationType(type.id)}
          >
            <Icon
              name={type.icon}
              size={16}
              color={selectedTypes.includes(type.id) ? '#fff' : type.color}
            />
            <Text
              style={[
                styles.filterText,
                selectedTypes.includes(type.id) && styles.filterTextActive,
              ]}
            >
              {type.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 6.4281,
          longitude: 3.4219,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {filteredLocations.map((location: MapLocation) => (
          <Marker
            key={location.id}
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            onPress={() => handleMarkerPress(location)}
          >
            <View style={[styles.marker, { backgroundColor: getMarkerColor(location.type) }]}>
              <Icon
                name={LOCATION_TYPES.find(t => t.id === location.type)?.icon || 'map-marker'}
                size={20}
                color="#fff"
              />
            </View>
          </Marker>
        ))}

        {showRiskZones && riskZones.map((zone: RiskZone) => (
          <Circle
            key={zone.id}
            center={zone.center}
            radius={zone.radius}
            fillColor={RISK_COLORS[zone.riskLevel]}
            strokeColor={RISK_COLORS[zone.riskLevel].replace('0.3', '0.8')}
            strokeWidth={2}
          />
        ))}
      </MapView>

      <FAB
        icon="crosshairs-gps"
        style={styles.fab}
        onPress={centerOnUserLocation}
        color={theme.colors.primary}
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedLocation && (
            <Card style={styles.locationCard}>
              <Card.Content>
                <View style={styles.locationHeader}>
                  <View style={[styles.locationIcon, { backgroundColor: getMarkerColor(selectedLocation.type) + '20' }]}>
                    <Icon
                      name={LOCATION_TYPES.find(t => t.id === selectedLocation.type)?.icon || 'map-marker'}
                      size={28}
                      color={getMarkerColor(selectedLocation.type)}
                    />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{selectedLocation.name}</Text>
                    <Text style={styles.locationType}>
                      {LOCATION_TYPES.find(t => t.id === selectedLocation.type)?.name}
                    </Text>
                  </View>
                  {selectedLocation.rating && (
                    <View style={styles.ratingBadge}>
                      <Icon name="star" size={14} color="#f59e0b" />
                      <Text style={styles.ratingText}>{selectedLocation.rating}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.locationDetails}>
                  <View style={styles.detailRow}>
                    <Icon name="map-marker" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.detailText}>{selectedLocation.address}</Text>
                  </View>
                  {selectedLocation.phone && (
                    <View style={styles.detailRow}>
                      <Icon name="phone" size={16} color={theme.colors.textSecondary} />
                      <Text style={styles.detailText}>{selectedLocation.phone}</Text>
                    </View>
                  )}
                  {selectedLocation.distance && (
                    <View style={styles.detailRow}>
                      <Icon name="map-marker-distance" size={16} color={theme.colors.textSecondary} />
                      <Text style={styles.detailText}>{selectedLocation.distance} km away</Text>
                    </View>
                  )}
                </View>

                {selectedLocation.services && (
                  <View style={styles.servicesContainer}>
                    {selectedLocation.services.map((service, index) => (
                      <Chip key={index} style={styles.serviceChip} textStyle={styles.serviceText}>
                        {service}
                      </Chip>
                    ))}
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Icon name="directions" size={20} color={theme.colors.primary} />
                    <Text style={styles.actionText}>Directions</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Icon name="phone" size={20} color={theme.colors.success} />
                    <Text style={[styles.actionText, { color: theme.colors.success }]}>Call</Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Card>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    zIndex: 1,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  riskButton: {
    padding: spacing.sm,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.warning + '20',
  },
  riskButtonActive: {
    backgroundColor: theme.colors.warning,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterText: {
    ...typography.small,
    color: theme.colors.text,
    marginLeft: spacing.xs,
  },
  filterTextActive: {
    color: '#fff',
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xl,
    backgroundColor: '#fff',
  },
  modalContainer: {
    padding: spacing.md,
  },
  locationCard: {
    marginHorizontal: spacing.md,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locationIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  locationName: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  locationType: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: theme.roundness,
  },
  ratingText: {
    ...typography.caption,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: spacing.xs,
  },
  locationDetails: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailText: {
    ...typography.body,
    color: theme.colors.text,
    marginLeft: spacing.sm,
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  serviceChip: {
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    backgroundColor: theme.colors.primary + '15',
  },
  serviceText: {
    ...typography.small,
    color: theme.colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  actionText: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.primary,
    marginLeft: spacing.sm,
  },
});
