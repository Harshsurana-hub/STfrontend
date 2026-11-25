import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Course } from '@/types';

export interface CartItem {
  courseId: string;
  course: Course;
  addedAt: string;
}

interface CartState {
  items: CartItem[];
  addItem: (course: Course) => void;
  addItems: (courses: Course[]) => number;
  removeItem: (courseId: string) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getTotalPrice: () => number;
}

/**
 * A course price is only usable if it is a finite, non-negative number.
 * Guards against partial API payloads and carts persisted from older schemas.
 */
export function isValidPrice(price: unknown): price is number {
  return typeof price === 'number' && Number.isFinite(price) && price >= 0;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (course: Course) => {
        if (!isValidPrice(course?.price)) return;

        const { items } = get();
        if (items.some((item) => item.courseId === course.id)) return;

        set({
          items: [
            ...items,
            {
              courseId: course.id,
              course,
              addedAt: new Date().toISOString(),
            },
          ],
        });
      },

      addItems: (courses: Course[]) => {
        const { items } = get();
        const existingIds = new Set(items.map((item) => item.courseId));
        const newItems: CartItem[] = [];

        for (const course of courses) {
          if (!isValidPrice(course?.price)) continue;
          if (existingIds.has(course.id)) continue;

          existingIds.add(course.id);
          newItems.push({
            courseId: course.id,
            course,
            addedAt: new Date().toISOString(),
          });
        }

        if (newItems.length > 0) {
          set({ items: [...items, ...newItems] });
        }

        return newItems.length;
      },

      removeItem: (courseId: string) => {
        set({ items: get().items.filter((item) => item.courseId !== courseId) });
      },

      clearCart: () => {
        set({ items: [] });
      },

      getItemCount: () => get().items.length,

      getTotalPrice: () =>
        get().items.reduce(
          (total, item) =>
            isValidPrice(item.course?.price) ? total + item.course.price : total,
          0
        ),
    }),
    {
      name: 'cart-storage',
    }
  )
);

export const useCartHydrated = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubFinishHydration = useCartStore.persist.onFinishHydration(() =>
      setHydrated(true)
    );
    setHydrated(useCartStore.persist.hasHydrated());

    return () => {
      unsubFinishHydration();
    };
  }, []);

  return hydrated;
};
