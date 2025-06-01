import { useState, Fragment } from 'react';
import { LogOut, User } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { useAuth } from '../contexts/AuthContext';

export default function UserSwitcher() {
  const { currentUser, logout, switchUser } = useAuth();

  return (
    <Menu as="div" className="ml-3 relative">
      {({ open }) => (
        <>
          <div>
            <Menu.Button className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <span className="sr-only">ユーザーメニュー</span>
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                {currentUser?.name.charAt(0)}
              </div>
            </Menu.Button>
          </div>
          <Transition
            show={open}
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items
              static
              className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
            >
              <div className="px-4 py-2">
                <p className="text-sm font-medium text-gray-900">{currentUser?.name}</p>
                <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
              </div>
              <div className="border-t border-gray-100"></div>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={switchUser}
                    className={`${
                      active ? 'bg-gray-100' : ''
                    } flex w-full px-4 py-2 text-sm text-gray-700`}
                  >
                    <User className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                    <span>ユーザー切替</span>
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={logout}
                    className={`${
                      active ? 'bg-gray-100' : ''
                    } flex w-full px-4 py-2 text-sm text-gray-700`}
                  >
                    <LogOut className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                    <span>ログアウト</span>
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  );
}