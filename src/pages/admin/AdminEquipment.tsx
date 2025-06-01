import { useState } from 'react';
import { mockRooms, mockVehicles, mockSampleEquipment } from '../../data/mockData';
import { Room, Vehicle, SampleEquipment } from '../../types';
import { Plus, Pencil, Trash2, Car, DoorOpen, Box, X } from 'lucide-react';

export default function AdminEquipment() {
  // State for each equipment type
  const [rooms, setRooms] = useState<Room[]>(() => {
    const savedRooms = localStorage.getItem('rooms');
    return savedRooms ? JSON.parse(savedRooms) : mockRooms;
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const savedVehicles = localStorage.getItem('vehicles');
    return savedVehicles ? JSON.parse(savedVehicles) : mockVehicles;
  });

  const [sampleEquipment, setSampleEquipment] = useState<SampleEquipment[]>(() => {
    const savedEquipment = localStorage.getItem('sampleEquipment');
    return savedEquipment ? JSON.parse(savedEquipment) : mockSampleEquipment;
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'room' | 'vehicle' | 'sample' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  // Save functions
  const saveRooms = (newRooms: Room[]) => {
    setRooms(newRooms);
    localStorage.setItem('rooms', JSON.stringify(newRooms));
  };

  const saveVehicles = (newVehicles: Vehicle[]) => {
    setVehicles(newVehicles);
    localStorage.setItem('vehicles', JSON.stringify(newVehicles));
  };

  const saveSampleEquipment = (newEquipment: SampleEquipment[]) => {
    setSampleEquipment(newEquipment);
    localStorage.setItem('sampleEquipment', JSON.stringify(newEquipment));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newId = Date.now().toString();
    
    switch (modalType) {
      case 'room':
        if (editingItem) {
          const updatedRooms = rooms.map(room => 
            room.id === editingItem.id ? { ...room, ...formData } : room
          );
          saveRooms(updatedRooms);
        } else {
          const newRoom: Room = {
            id: newId,
            name: formData.name || '',
            createdBy: '1', // Assuming current user ID
          };
          saveRooms([...rooms, newRoom]);
        }
        break;

      case 'vehicle':
        if (editingItem) {
          const updatedVehicles = vehicles.map(vehicle => 
            vehicle.id === editingItem.id ? { ...vehicle, ...formData } : vehicle
          );
          saveVehicles(updatedVehicles);
        } else {
          const newVehicle: Vehicle = {
            id: newId,
            name: formData.name || '',
            licensePlate: formData.licensePlate || '',
            type: formData.type || '',
            createdBy: '1', // Assuming current user ID
          };
          saveVehicles([...vehicles, newVehicle]);
        }
        break;

      case 'sample':
        if (editingItem) {
          const updatedEquipment = sampleEquipment.map(equipment => 
            equipment.id === editingItem.id ? { ...equipment, ...formData } : equipment
          );
          saveSampleEquipment(updatedEquipment);
        } else {
          const newEquipment: SampleEquipment = {
            id: newId,
            name: formData.name || '',
            type: formData.type || 'CAD・マーキング',
          };
          saveSampleEquipment([...sampleEquipment, newEquipment]);
        }
        break;
    }

    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({});
    setModalType(null);
  };

  // Handle edit
  const handleEdit = (item: any, type: 'room' | 'vehicle' | 'sample') => {
    setEditingItem(item);
    setFormData(item);
    setModalType(type);
    setIsModalOpen(true);
  };

  // Handle delete
  const handleDelete = (id: string, type: 'room' | 'vehicle' | 'sample') => {
    if (confirm('この設備を削除してもよろしいですか？')) {
      switch (type) {
        case 'room':
          saveRooms(rooms.filter(room => room.id !== id));
          break;
        case 'vehicle':
          saveVehicles(vehicles.filter(vehicle => vehicle.id !== id));
          break;
        case 'sample':
          saveSampleEquipment(sampleEquipment.filter(equipment => equipment.id !== id));
          break;
      }
    }
  };

  return (
    <div className="h-full flex flex-col space-y-8">
      {/* Rooms Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">会議室</h2>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({});
              setModalType('room');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            <DoorOpen className="h-5 w-5 mr-1" />
            会議室を追加
          </button>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  会議室名
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">アクション</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <DoorOpen className="h-5 w-5 text-emerald-600" />
                      
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{room.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(room, 'room')}
                      className="text-emerald-600 hover:text-emerald-900 mr-3"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id, 'room')}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vehicles Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">車両</h2>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({});
              setModalType('vehicle');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
          >
            <Car className="h-5 w-5 mr-1" />
            車両を追加
          </button>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  車両情報
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ナンバー
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  車種
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">アクション</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Car className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{vehicle.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.licensePlate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(vehicle, 'vehicle')}
                      className="text-amber-600 hover:text-amber-900 mr-3"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(vehicle.id, 'vehicle')}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample Equipment Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">サンプル設備</h2>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({});
              setModalType('sample');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <Box className="h-5 w-5 mr-1" />
            設備を追加
          </button>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  設備名
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  種別
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">アクション</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sampleEquipment.map((equipment) => (
                <tr key={equipment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <Box className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{equipment.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {equipment.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(equipment, 'sample')}
                      className="text-purple-600 hover:text-purple-900 mr-3"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(equipment.id, 'sample')}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingItem ? '編集' : '新規作成'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {modalType === 'room' ? '会議室名' :
                   modalType === 'vehicle' ? '車両名' : '設備名'}
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              {modalType === 'vehicle' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ナンバープレート</label>
                    <input
                      type="text"
                      value={formData.licensePlate || ''}
                      onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">車種</label>
                    <select
                      value={formData.type || ''}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="フリード">フリード</option>
                      <option value="軽トラ">軽トラ</option>
                      <option value="タウンボックス">タウンボックス</option>
                    </select>
                  </div>
                </>
              )}

              {modalType === 'sample' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">種別</label>
                  <select
                    value={formData.type || ''}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="CAD・マーキング">CAD・マーキング</option>
                    <option value="サンプル裁断">サンプル裁断</option>
                    <option value="サンプル縫製">サンプル縫製</option>
                    <option value="サンプル内職">サンプル内職</option>
                    <option value="プレス">プレス</option>
                    <option value="仕上げ・梱包">仕上げ・梱包</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {editingItem ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}