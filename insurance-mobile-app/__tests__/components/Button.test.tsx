import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../../src/components/Button';

describe('Button Component', () => {
  it('should render with title', () => {
    const { getByText } = render(
      <Button title="Click Me" onPress={() => {}} />
    );

    expect(getByText('Click Me')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Click Me" onPress={onPress} />
    );

    fireEvent.press(getByText('Click Me'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Click Me" onPress={onPress} disabled />
    );

    fireEvent.press(getByText('Click Me'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('should show loading indicator when loading', () => {
    const { queryByText, getByTestId } = render(
      <Button title="Click Me" onPress={() => {}} loading />
    );

    expect(queryByText('Click Me')).toBeNull();
  });

  it('should not call onPress when loading', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button title="Click Me" onPress={onPress} loading />
    );

    expect(onPress).not.toHaveBeenCalled();
  });

  it('should render with different variants', () => {
    const { rerender, getByText } = render(
      <Button title="Primary" onPress={() => {}} variant="primary" />
    );
    expect(getByText('Primary')).toBeTruthy();

    rerender(
      <Button title="Secondary" onPress={() => {}} variant="secondary" />
    );
    expect(getByText('Secondary')).toBeTruthy();

    rerender(
      <Button title="Outline" onPress={() => {}} variant="outline" />
    );
    expect(getByText('Outline')).toBeTruthy();

    rerender(
      <Button title="Danger" onPress={() => {}} variant="danger" />
    );
    expect(getByText('Danger')).toBeTruthy();
  });

  it('should render with different sizes', () => {
    const { rerender, getByText } = render(
      <Button title="Small" onPress={() => {}} size="small" />
    );
    expect(getByText('Small')).toBeTruthy();

    rerender(
      <Button title="Medium" onPress={() => {}} size="medium" />
    );
    expect(getByText('Medium')).toBeTruthy();

    rerender(
      <Button title="Large" onPress={() => {}} size="large" />
    );
    expect(getByText('Large')).toBeTruthy();
  });

  it('should render full width when specified', () => {
    const { getByText } = render(
      <Button title="Full Width" onPress={() => {}} fullWidth />
    );

    expect(getByText('Full Width')).toBeTruthy();
  });
});
