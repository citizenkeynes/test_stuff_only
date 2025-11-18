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
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LM_AdvertListItem,
  LM_FilterBar,
  LM_Text,
  LM_TextInput,
} from '../../components';
import { LM } from '../../constants';
import {
  getAdvertCategoryColor,
  getAdvertCategoryIconBig,
} from '../../functions';

const Advert_List: FC = ({ route, navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [listings, setListings] = useState<readonly Listing[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number>(
    route?.params?.category || 0,
  );
  const [type, setType] = useState(route?.params?.type || 'ALL');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getT } = useApiTranslation();

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
    // Will be used for filtering in future implementation
  }, []);

  const fetchAdverts = useCallback(async ({
    categoryId,
    advertType,
  }: {
    categoryId: Category['id'];
    advertType?: string;
  }) => {
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
            console.error('Error details:', JSON.stringify(error, undefined, 2));
          },
          onSuccess: (list) => {
            setListings(list);
          },
        },
      ),
    );

    setLoading(false);
    setUpdating(false);
  }, []);

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
          },
        },
      ),
    );
  };

  const handleTypeChange = useCallback((newType: string, currentCategory: number) => {
    setType(newType);
    fetchAdverts({ categoryId: currentCategory, advertType: newType });
    triggerHapticFeedback();
  }, [fetchAdverts]);

  const handleCategoryChange = (currentType: string, newCategoryId: number) => {
    setSelectedCategory(newCategoryId);
    fetchAdverts({ categoryId: newCategoryId, advertType: currentType });
    triggerHapticFeedback();
  };

  const reloadAdverts = () => {
    fetchCategories();
    fetchAdverts({ categoryId: selectedCategory, advertType: type });
  };

  useFocusEffect(
    useCallback(() => {
      if (!route.params || Object.keys(route.params).length === 0) {
        reloadAdverts();
      }
      if (route?.params?.category) {
        handleCategoryChange('ALL', route.params.category);
        delete route.params.category;
      }
    }, [route, handleTypeChange]),
  );

  const renderCategoryItem = ({ item }: { item: Category }) => {
    return (
      <Pressable
        onPress={() => {
          handleCategoryChange(type, item.id);
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

  const FooterComponent: React.FC = () =>
    !!(updating && !loading && selectedCategory) && (
      <View style={LM.margin_y_rg}>
        <ActivityIndicator color={LM.text_light} />
      </View>
    );

  const EmptyComponent = (
    <View style={[LM.padding_rg, LM.items_center, { marginTop: 40 }]}>
      <LM_Text type="h3" style={{ color: LM.text_light, marginBottom: 8 }}>
        Keine Anzeigen
      </LM_Text>
      <LM_Text type="body" style={{ color: LM.text_light, textAlign: 'center' }}>
        Es gibt noch keine Anzeigen in dieser Kategorie.
      </LM_Text>
    </View>
  );

  const currentUser = useUserStore((state) => state.user);

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
        {
          backgroundColor:
            categories.length === 0 || listings?.length
              ? LM.background_white
              : LM.background_neutral,
        },
      ]}>
      <View style={[LM.flex]}>
        {/* Header Section */}
        <View style={[LM.padding_rg, { backgroundColor: LM.background_neutral }]}>
          <LM_TextInput
            type="search"
            onChangeText={handleSearch}
            value={searchText}
            placeholder="Suche nach Anzeigen..."
          />

          <View style={[LM.margin_t_rg]}>
            <LM_FilterBar
              style={[LM.flex]}
              pillBarOptions={[
                { value: 'OFFER', label: 'Angebot' },
                { value: 'ALL', label: 'Marktplatz' },
                { value: 'REQUEST', label: 'Nachfrage' },
              ]}
              activeType={type}
              onPress={(newType: string) => handleTypeChange(newType, selectedCategory)}
            />
          </View>

          {!loading && categories.length > 0 && (
            <FlatList
              horizontal={true}
              data={categories}
              keyExtractor={(categoryItem) => categoryItem.id.toString()}
              estimatedItemSize={19}
              renderItem={renderCategoryItem}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                LM.gap_rg,
                LM.padding_t_sm,
                LM.padding_r_rg,
                LM.padding_b_rg,
                LM.padding_l_sm,
              ]}
              style={{ marginTop: 12 }}
            />
          )}
        </View>

        {/* Listings Section */}
        <FlashList
          data={categories.length === 0 || listings.length === 0 ? [] : listings}
          numColumns={2}
          estimatedItemSize={275}
          contentContainerStyle={[LM.padding_rg]}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListFooterComponent={() => <FooterComponent />}
          ListEmptyComponent={EmptyComponent}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        />
      </View>
    </SafeAreaView>
  );
};

export default Advert_List;
