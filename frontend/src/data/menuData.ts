import { MenuItem } from '../types/menu';
import roastedCrImg from '../assets/roastedcr.png';
import cktImg from '../assets/ckt.png';
import curryLaksaImg from '../assets/currylaksa.png';
import wontonMeeImg from '../assets/wontonmee.png';

export const menuItems: MenuItem[] = [
  {
    id: 'm1',
    name: 'Roasted Chicken Rice',
    price: 5.50,
    category: 'Rice Dishes',
    image: roastedCrImg,
    ingredients: [
      { inventoryItemId: '5', inventoryItemName: 'Chicken Breast', quantity: 150, unit: 'g' },
      { inventoryItemId: '11', inventoryItemName: 'Brown Rice', quantity: 200, unit: 'g' },
      { inventoryItemId: '8', inventoryItemName: 'Chili Paste', quantity: 30, unit: 'g' },
      { inventoryItemId: '9', inventoryItemName: 'Soy Sauce', quantity: 20, unit: 'ml' }
    ]
  },
  {
    id: 'm2',
    name: 'Char Kway Teow',
    price: 6.00,
    category: 'Noodle Dishes',
    image: cktImg,
    ingredients: [
      { inventoryItemId: '1', inventoryItemName: 'Yellow Noodles', quantity: 150, unit: 'g' },
      { inventoryItemId: '3', inventoryItemName: 'Eggs', quantity: 1, unit: 'pcs' },
      { inventoryItemId: '4', inventoryItemName: 'Prawns', quantity: 50, unit: 'g' },
      { inventoryItemId: '7', inventoryItemName: 'Bean Sprouts', quantity: 80, unit: 'g' },
      { inventoryItemId: '10', inventoryItemName: 'Cooking Oil', quantity: 30, unit: 'ml' }
    ]
  },
  {
    id: 'm3',
    name: 'Curry Laksa',
    price: 6.50,
    category: 'Noodle Dishes',
    image: curryLaksaImg,
    ingredients: [
      { inventoryItemId: '1', inventoryItemName: 'Yellow Noodles', quantity: 180, unit: 'g' },
      { inventoryItemId: '4', inventoryItemName: 'Prawns', quantity: 60, unit: 'g' },
      { inventoryItemId: '6', inventoryItemName: 'Bok Choy', quantity: 100, unit: 'g' },
      { inventoryItemId: '7', inventoryItemName: 'Bean Sprouts', quantity: 60, unit: 'g' }
    ]
  },
  {
    id: 'm4',
    name: 'Wonton Mee',
    price: 5.00,
    category: 'Noodle Dishes',
    image: wontonMeeImg,
    ingredients: [
      { inventoryItemId: '1', inventoryItemName: 'Yellow Noodles', quantity: 160, unit: 'g' },
      { inventoryItemId: '6', inventoryItemName: 'Bok Choy', quantity: 80, unit: 'g' },
      { inventoryItemId: '9', inventoryItemName: 'Soy Sauce', quantity: 25, unit: 'ml' }
    ]
  }
];
