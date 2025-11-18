import { toast, ToastPosition } from '@backpackapp-io/react-native-toast';
import { triggerHapticFeedback } from '@common';
import {
  Category,
  fetchCategories as fetchCategoriesApi,
  fetchListings,
  Listing,
  ListingsFetchQuerySizes,
  useListingLikesFromListing,
} from '@core/api';
import { useUserStore } from '@core/auth';
import { useApiTranslation } from '@l10n';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Effect } from 'effect';
import { FC, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LM_AdvertListItem, LM_FilterBar, LM_Text, LM_TextInput } from '../../components';
import { LM } from '../../constants';
import {
  getAdvertCategoryColor,
  getAdvertCategoryIconBig,
} from '../../functions';

const Advert_List: FC = ({ route, navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number>(
    route?.params?.category || 0,
  );
  const [type, setType] = useState<string>(route?.params?.type || 'ALL');
  const [listings, setListings] = useState<readonly Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getT } = useApiTranslation();
  const currentUser = useUserStore((state) => state.user);

  // Debouncing logic for search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 500); // 500ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchText]);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  const fetchAdverts = useCallback(
    async (categoryId: number, advertType: string) => {
      setError(null);
      setUpdating(true);

      await Effect.runPromise(
        Effect.match(
          fetchListings({
            querySize: ListingsFetchQuerySizes.Md,
            limit: 20,
            filter: {
              categoryIds: categoryId ? [categoryId] : [],
              type: advertType === 'ALL' ? undefined : advertType,
            },
          }),
          {
            onFailure: (error) => {
              setError(error.message || 'An error occurred');
              console.error('Failed to load adverts:', error);
            },
            onSuccess: (list) => {
              setListings(list);
            },
          },
        ),
      );

      setUpdating(false);
    },
    [],
  );

  const fetchCategories = async () => {
    await Effect.runPromise(
      Effect.match(
        fetchCategoriesApi({
          filter: {
            parentId: undefined,
          },
        }),
        {
          onFailure: (error) => {
            setError(error.message || 'An error occurred');
            console.error('Failed to load categories:', error);
          },
          onSuccess: (categoriesResponse) => {
            setCategories([
              {
                code: '',
                parentId: null,
                id: 0,
                translations: [
                  {
                    languagesCode: { code: 'de' },
                    title: 'Entdecken',
                    slug: '',
                  },
                ],
              },
              ...categoriesResponse,
            ]);
            setLoading(false);
          },
        },
      ),
    );
  };

  const handleCategoryChange = useCallback(
    (newCategoryId: number) => {
      setSelectedCategory(newCategoryId);
      triggerHapticFeedback();
      fetchAdverts(newCategoryId, type);
    },
    [fetchAdverts, type],
  );

  const handleTypeChange = useCallback(
    (newType: string) => {
      setType(newType);
      triggerHapticFeedback();
      fetchAdverts(selectedCategory, newType);
    },
    [fetchAdverts, selectedCategory],
  );

  useFocusEffect(
    useCallback(() => {
      if (!route.params || Object.keys(route.params).length === 0) {
        fetchCategories();
        fetchAdverts(selectedCategory, type);
      }
      if (route?.params?.category) {
        handleCategoryChange(route.params.category);
        delete route.params.category;
      }
    }, [route, handleCategoryChange, selectedCategory, type]),
  );

  const renderCategoryItem = ({ item }: { item: Category }) => {
    return (
      <Pressable
        onPress={() => {
          handleCategoryChange(item.id);
        }}
        unstable_pressDelay={75}>
        {({ pressed }) => (
          <View style={[LM.items_center, LM.gap_sm, LM.width_x4l]}>
            {pressed
              ? getAdvertCategoryIconBig(item.image?.id, 'active')
              : selectedCategory === item.id
                ? getAdvertCategoryIconBig(item.image?.id, 'active')
                : getAdvertCategoryIconBig(item.image?.id, 'disabled')}
            <LM_Text
              type={'tiny'}
              style={[
                LM.items_center,
                {
                  color: pressed
                    ? getAdvertCategoryColor('', 'pressed')
                    : selectedCategory === item.id
                      ? getAdvertCategoryColor('', 'active')
                      : LM.text_light,
                },
              ]}
              numberOfLines={1}>
              {getT(item.translations ?? [])?.title}
            </LM_Text>
          </View>
        )}
      </Pressable>
    );
  };

  const ListingItemWithLike: FC<{ item: Listing; index: number }> = ({ item, index }) => {
    const { isLiked, toggleLike, isToggling } = useListingLikesFromListing(
      item,
      currentUser?.id || null,
    );

    const handleLikeToggle = useCallback(async () => {
      const wasLiked = isLiked;
      try {
        await toggleLike();
        triggerHapticFeedback();
        toast.success(
          wasLiked
            ? 'Die Anzeige wurde aus deiner Merkliste entfernt.'
            : 'Die Anzeige wurde deiner Merkliste hinzugefügt.',
          {
            position: ToastPosition.BOTTOM,
          },
        );
      } catch (err) {
        console.error('Error toggling like:', err);
        toast.error(
          wasLiked
            ? 'Fehler beim Entfernen der Anzeige aus deiner Merkliste.'
            : 'Fehler beim Hinzufügen der Anzeige zur Merkliste.',
          {
            position: ToastPosition.BOTTOM,
          },
        );
      }
    }, [isLiked, toggleLike]);

    return (
      <LM_AdvertListItem
        index={index}
        advert={item}
        navigation={navigation}
        likeAdvert={handleLikeToggle}
        unlikeAdvert={handleLikeToggle}
        isLiked={isLiked}
        isToggling={isToggling}
      />
    );
  };

  const renderItem = ({ item, index }: { item: Listing; index: number }) => (
    <ListingItemWithLike item={item} index={index} />
  );

  return (
    <SafeAreaView
      edges={['left', 'top', 'right']}
      style={[
        LM.flex,
        { backgroundColor: LM.background_neutral },
      ]}>
      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <LM_Text type="h3" style={styles.navTitle}>
          Marktplatz
        </LM_Text>
      </View>

      <View style={[LM.flex]}>
        {/* Header Section with Search and Categories */}
        <View style={[LM.padding_rg, { backgroundColor: LM.background_neutral }]}>
          <LM_TextInput
            type="search"
            onChangeText={handleSearch}
            value={searchText}
            placeholder="Suche nach Anzeigen..."
          />

          {/* Filter Bar */}
          <View style={[LM.margin_t_rg]}>
            <LM_FilterBar
              pillBarOptions={[
                { value: 'OFFER', label: 'Angebot' },
                { value: 'ALL', label: 'Marktplatz' },
                { value: 'REQUEST', label: 'Nachfrage' },
              ]}
              activeType={type}
              onPress={handleTypeChange}
            />
          </View>

          {!loading && categories.length > 0 && (
            <View style={[LM.margin_t_rg]}>
              <LM_Text type="small" style={{ color: LM.text_light, marginBottom: 8 }}>
                Kategorien:
              </LM_Text>
              <FlatList
                horizontal={true}
                data={categories}
                keyExtractor={(categoryItem) => categoryItem.id.toString()}
                renderItem={renderCategoryItem}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[LM.gap_rg]}
              />
            </View>
          )}

          {selectedCategory !== 0 && (
            <View
              style={[
                LM.padding_rg,
                LM.margin_t_rg,
                {
                  backgroundColor: LM.background_white,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#4CAF50',
                },
              ]}>
              <LM_Text type="small" style={{ color: LM.text_light }}>
                Ausgewählte Kategorie:
              </LM_Text>
              <LM_Text type="body" style={{ marginTop: 4 }}>
                {getT(
                  categories.find((cat) => cat.id === selectedCategory)
                    ?.translations ?? [],
                )?.title || 'Unbekannt'}
              </LM_Text>
            </View>
          )}

          {debouncedSearchText && (
            <View
              style={[
                LM.padding_rg,
                LM.margin_t_rg,
                {
                  backgroundColor: LM.background_white,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#2196F3',
                },
              ]}>
              <LM_Text type="small" style={{ color: LM.text_light }}>
                Suche nach:
              </LM_Text>
              <LM_Text type="body" style={{ marginTop: 4 }}>
                {debouncedSearchText}
              </LM_Text>
            </View>
          )}

          {loading && (
            <View style={[LM.padding_rg, LM.margin_t_rg]}>
              <LM_Text type="body" style={{ color: LM.text_light }}>
                Kategorien werden geladen...
              </LM_Text>
            </View>
          )}

          {error && (
            <View
              style={[
                LM.padding_rg,
                LM.margin_t_rg,
                {
                  backgroundColor: '#ffebee',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#f44336',
                },
              ]}>
              <LM_Text type="small" style={{ color: '#c62828' }}>
                Fehler:
              </LM_Text>
              <LM_Text type="body" style={{ marginTop: 4, color: '#c62828' }}>
                {error}
              </LM_Text>
            </View>
          )}
        </View>

        {/* Listings Section */}
        <View style={[LM.flex, { backgroundColor: LM.background_white }]}>
          {updating && (
            <View style={[LM.padding_rg]}>
              <ActivityIndicator color={LM.text_light} size="large" />
              <LM_Text
                type="body"
                style={{ color: LM.text_light, textAlign: 'center', marginTop: 8 }}>
                Anzeigen werden geladen...
              </LM_Text>
            </View>
          )}

          {!updating && listings.length === 0 ? (
            <View style={[LM.padding_rg, LM.items_center, { marginTop: 40 }]}>
              <LM_Text type="h3" style={{ color: LM.text_light, marginBottom: 8 }}>
                Keine Anzeigen
              </LM_Text>
              <LM_Text type="body" style={{ color: LM.text_light, textAlign: 'center' }}>
                Es gibt noch keine Anzeigen in dieser Kategorie.
              </LM_Text>
            </View>
          ) : (
            <FlashList
              data={listings}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              estimatedItemSize={275}
              contentContainerStyle={[LM.padding_rg]}
              ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  navBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});

export default Advert_List;
