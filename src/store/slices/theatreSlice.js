import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  selectedTheatre: null, // '35mm Screen Desk' | '70mm Screen Desk'
};

const theatreSlice = createSlice({
  name: 'theatre',
  initialState,
  reducers: {
    setTheatre: (state, action) => {
      state.selectedTheatre = action.payload;
    },
    clearTheatre: (state) => {
      state.selectedTheatre = null;
    }
  },
});

export const { setTheatre, clearTheatre } = theatreSlice.actions;
export default theatreSlice.reducer;
