import { useState, useEffect } from 'react'
import { Keyboard } from 'react-native'

export function useKeyboard() {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardVisible(true)
      setKeyboardHeight(e.endCoordinates.height)
    })

    const keyboardWillHide = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardVisible(false)
      setKeyboardHeight(0)
    })

    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true)
      setKeyboardHeight(e.endCoordinates.height)
    })

    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false)
      setKeyboardHeight(0)
    })

    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
      keyboardDidShow.remove()
      keyboardDidHide.remove()
    }
  }, [])

  return { isKeyboardVisible, keyboardHeight }
}
