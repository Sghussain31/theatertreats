import React, { createContext, useState } from 'react';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userRole, setUserRole] = useState('Staff'); // 'Staff' or 'Admin'
  const [userName, setUserName] = useState('Hussain');
  const [phoneNumber, setPhoneNumber] = useState('+91 9848065558');
  const [theater, setTheater] = useState('35mm Screen Desk');

  return (
    <UserContext.Provider value={{ userRole, setUserRole, userName, setUserName, phoneNumber, setPhoneNumber, theater, setTheater }}>
      {children}
    </UserContext.Provider>
  );
};
