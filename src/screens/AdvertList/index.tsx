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
import { FC, forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LM_AdvertListItem,
  LM_Awning,
  LM_EmptyList,
  LM_ErrorBanner,
  LM_FilterBar,
  // TODO: Needed for design change
  // LM_TabBar,
  LM_Text,
  LM_TextInput,
} from '../../components';
import { LM } from '../../constants';
import {
  getAdvertCategoryColor,
  getAdvertCategoryIconBig,
} from '../../functions';

const BOUNCE_SPACER = 1000; // Needed on iOS to set the background color of the bounce area

type CustomScrollComponentProps = {
  categories: readonly Category[];
  loading: boolean;
  type: string;
  category: number;
  renderCategoryItem: ({ item }: { item: Category }) => React.ReactNode;
  searchText: string;
  handleSearch: (text: string) => void;
  debouncedSearchText: string;
  onPress: (newType: string, newCategory: number) => void;
  error: string | null;
  children: React.ReactNode;
};
const CustomScrollComponent = forwardRef<
  ScrollView,
  CustomScrollComponentProps
>(
  (
    {
      loading,
      type,
      category,
      categories,
      renderCategoryItem,
      searchText,
      handleSearch,
      debouncedSearchText,
      onPress,
      error,
      ...props
    },
    ref,
  ) => {
    return (
      <ScrollView stickyHeaderIndices={[1]} ref={ref} {...props}>
        {/* 2 loading conditions because if wrapped in <> stickyHeaderIndices doesn't work */}
        {!loading && (
          <View
            style={[
              LM.padding_x_rg,
              // TODO: Temporary fix so focus border isn't cut off
              // LM.padding_b_xxs,
              {
                backgroundColor: LM.background_neutral,
                marginTop: -BOUNCE_SPACER,
                paddingTop: BOUNCE_SPACER + 16,
              },
            ]}>
            <LM_TextInput
              type="search"
              onChangeText={handleSearch}
              value={searchText}
              placeholder="Suche nach Anzeigen..."
            />
          </View>
        )}
        {!loading && (
          <View style={LM.margin_b_rg}>
            <LM_FilterBar
              style={[
                LM.flex,
                LM.padding_t_rg,
                { backgroundColor: LM.background_neutral },
              ]}
              pillBarOptions={[
                { value: 'OFFER', label: 'Angebot' },
                { value: 'ALL', label: 'Marktplatz' },
                { value: 'REQUEST', label: 'Nachfrage' },
              ]}
              activeType={type}
              onPress={(newType: string) => onPress(newType, category)}
            />
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
              backgroundColor={LM.background_neutral}
            />
            <LM_Awning style={{ height: LM.top_zero.top }} size={8} />
          </View>
        )}
        <LM_ErrorBanner error={error} style={[LM.margin_b_sm]} />
        {debouncedSearchText && (
          <View
            style={[
              LM.padding_rg,
              LM.margin_x_rg,
              LM.margin_b_sm,
              {
                backgroundColor: LM.background_neutral,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#e0e0e0',
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
        {props.children}
      </ScrollView>
    );
  },
);

const ItemSeparatorComponent = () => (
  <View style={LM.margin_b_sm} />
  // TODO: Needed for design change
  // <View style={[LM.border_bottom_neutral]} />
);

const Advert_List: FC = ({ route, navigation }) => {
  const [adverts, setAdverts] = useState({});
  const [listings, setListings] = useState<readonly Listing[]>([]);

  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number>(
    route?.params?.category || 0, // TODO set to null
  );
  const [type, setType] = useState(route?.params?.type || 'ALL');
  const [pages, setPages] = useState({ 0: { OFFER: 0, ALL: 0, REQUEST: 0 } });
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getT } = useApiTranslation();

  // Needed for scroll to top
  const advertListRef = useRef(null);
  // TODO: Need if scroll to top with header is implemented
  // const safeAreaInsets = useSafeAreaInsets();

  // Debouncing logic for search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 500); // 500ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchText]);

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
              }, // TODO delete hardcoded category
              ...categoriesResponse,
            ]);
          },
        },
      ),
    );
  };

  const handleTypeChange = useCallback((newType: string, currentCategory: number) => {
    advertListRef.current?.scrollToOffset({
      animated: true,
      offset: 0,
    });
    setType(newType);
    fetchAdverts({ categoryId: currentCategory, advertType: newType });
    triggerHapticFeedback();
  }, [fetchAdverts]);

  const handleCategoryChange = (currentType: string, newCategoryId: number) => {
    advertListRef.current?.scrollToOffset({
      animated: true,
      offset: 0,
    });
    setSelectedCategory(newCategoryId);

    // TODO: Really not needed because gets loaded through useFocusEffect with
    // no params condition?
    fetchAdverts({ categoryId: newCategoryId, advertType: currentType });
    triggerHapticFeedback();
  };

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    // Will be used for filtering in future implementation
  }, []);

  const reloadAdverts = () => {
    fetchCategories();
    // fetchAdverts({ [selectedCategory]: { [type]: 0 } }, type, selectedCategory);
    fetchAdverts({ categoryId: selectedCategory, advertType: type });
  };

  useFocusEffect(
    useCallback(() => {
      if (!route.params || Object.keys(route.params).length === 0) {
        reloadAdverts();
      }
      if (route?.params?.category) {
        handleCategoryChange('ALL', route.params.category);
        // Reset params so tab switching is possible again
        delete route.params.category;
      }
      // if (route?.params?.type) {
      //   handleTypeChange(route.params.type);
      //   // Reset params so tab switching is possible again
      //   delete route.params.type;
      // }
      // if (route?.params?.editedAdvert) {
      //   updateEditedAdvert(route.params.editedAdvert);
      //   delete route.params.editedAdvert;
      // }
      // if (route?.params?.deletedAdvert) {
      //   updateDeletedAdvert(route.params.deletedAdvert);
      //   delete route.params.deletedAdvert;
      // }
    }, [
      route,

      handleTypeChange,
      // updateEditedAdvert,
      // updateDeletedAdvert,
    ]),
  );

  // const updateEditedAdvert = useCallback(
  //   (updatedEditedAdvert) =>
  //     setAdverts((prevAdverts) => ({
  //       ...prevAdverts,
  //       [selectedCategory]: {
  //         ...prevAdverts[selectedCategory],
  //         [type]: prevAdverts[selectedCategory]?.[type].map((a) =>
  //           a.id === updatedEditedAdvert.id
  //             ? { ...a, ...updatedEditedAdvert }
  //             : a,
  //         ),
  //       },
  //     })),
  //   [selectedCategory, type],
  // );

  // const updateDeletedAdvert = useCallback(
  //   (updatedDeletedAdvert) =>
  //     setAdverts((prevAdverts) => ({
  //       ...prevAdverts,
  //       [selectedCategory]: {
  //         ...prevAdverts[selectedCategory],
  //         [type]: prevAdverts[selectedCategory]?.[type].filter(
  //           (a) => a.id !== updatedDeletedAdvert.id,
  //         ),
  //       },
  //     })),
  //   [selectedCategory, type],
  // );

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

  const CustomScrollComponentProps = {
    stickyHeaderIndices: [1],
    // TODO: test hiding sticky header
    // stickyHeaderHiddenOnScroll={true}
    loading: loading,
    type: type,
    category: selectedCategory,
    categories: categories,
    renderCategoryItem: renderCategoryItem,
    searchText: searchText,
    handleSearch: handleSearch,
    debouncedSearchText: debouncedSearchText,
    onPress: handleTypeChange,
    error: error,
  };

  const EmptyComponent = (
    <LM_EmptyList
      headingText={'Keine Anzeigen'}
      secondaryText={'Es gibt noch keine Anzeigen in dieser Kategorie.'}
      loading={categories.length === 0 || listings?.length === undefined}
    />
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
      <FlashList
        // Needed for scroll to top
        ref={advertListRef}
        data={categories.length === 0 || listings.length === 0 ? [] : listings}
        // TODO: Needed for animation
        // keyExtractor={item => item.id.toString()}
        numColumns={2}
        estimatedItemSize={275}
        // TODO: Needed for scroll to top with large header so negative offset
        // can be used
        // scrollToOverflowEnabled={true}
        contentInsetAdjustmentBehavior="automatic"
        renderScrollComponent={(props) => (
          <CustomScrollComponent
            loading={loading}
            type={type}
            category={selectedCategory}
            categories={categories}
            renderCategoryItem={renderCategoryItem}
            searchText={searchText}
            handleSearch={handleSearch}
            debouncedSearchText={debouncedSearchText}
            onPress={handleTypeChange}
            error={error}
            {...props}
          />
        )}
        overrideProps={CustomScrollComponentProps}
        // Only load next page if adverts[type]?.length is defined,
        // if not defined or 0 it means it is the first load with page 0
        // onEndReached={() =>
        //   adverts[selectedCategory]?.[type]?.length &&
        //   fetchAdverts(pages, type, selectedCategory)
        // } // TODO add infinity loading
        // onEndReachedThreshold={0.8}
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListFooterComponent={() => <FooterComponent />}
        ListEmptyComponent={EmptyComponent}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
      />
    </SafeAreaView>
  );
};

export default Advert_List;
