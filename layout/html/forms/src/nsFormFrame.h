/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * The contents of this file are subject to the Netscape Public License
 * Version 1.0 (the "NPL"); you may not use this file except in
 * compliance with the NPL.  You may obtain a copy of the NPL at
 * http://www.mozilla.org/NPL/
 *
 * Software distributed under the NPL is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the NPL
 * for the specific language governing rights and limitations under the
 * NPL.
 *
 * The Initial Developer of this code under the NPL is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation.  All Rights
 * Reserved.
 */
#ifndef nsFormFrame_h___
#define nsFormFrame_h___

#include "nsIFormManager.h"
#include "nsLeafFrame.h"
#include "nsVoidArray.h"

class  nsString;
class  nsIContent;
class  nsIFrame;
class  nsIPresContext;
struct nsHTMLReflowState;
class  nsFormControlFrame;
class  nsRadioControlFrame;
class  nsIFormControlFrame;
class  nsIDOMHTMLFormElement;

class nsIPresContext;
class nsFormFrame;
// XXX these structs and gFormFrameTable below provide a faster way to get from a form content to
// the appropriate frame. Before replacing this mechanism with FindFrameWithContent, please test
// a page with thousands of frames and hundreds of form controls.
struct nsFormFrameTableEntry 
{
  nsIPresContext*        mPresContext;
  nsIDOMHTMLFormElement* mFormElement;
  nsFormFrame*           mFormFrame;
  nsFormFrameTableEntry(nsIPresContext&        aPresContext, 
                        nsIDOMHTMLFormElement& aFormElement,
                        nsFormFrame&           aFormFrame) : mPresContext(&aPresContext), 
                                                             mFormElement(&aFormElement), 
                                                             mFormFrame(&aFormFrame) {}
};
struct nsFormFrameTable
{
  nsVoidArray mEntries;
  nsFormFrameTable() {}
  nsFormFrame* Get(nsIPresContext& aPresContext, nsIDOMHTMLFormElement& aFormElem) {
    PRInt32 count = mEntries.Count();
    for (PRInt32 i = 0; i < count; i++) {
      nsFormFrameTableEntry* entry = (nsFormFrameTableEntry *)mEntries.ElementAt(i);
      if ((entry->mPresContext == &aPresContext) && (entry->mFormElement == &aFormElem)) {
        return entry->mFormFrame;
      }
    }
    return nsnull;
  }
  void Put(nsIPresContext& aPresContext, nsIDOMHTMLFormElement& aFormElem, nsFormFrame& aFormFrame) {
    mEntries.AppendElement(new nsFormFrameTableEntry(aPresContext, aFormElem, aFormFrame));
  }
  ~nsFormFrameTable() { 
    PRInt32 count = mEntries.Count(); 
    for (PRInt32 i = 0; i < count; i++) {
      delete mEntries.ElementAt(i);
    }
  }
};

class nsFormFrame : public nsLeafFrame, 
                    public nsIFormManager
{
public:
  nsFormFrame(nsIContent* aContent, nsIFrame* aParentFrame);

  NS_IMETHOD Init(nsIPresContext& aPresContext, nsIFrame* aChildList);

  NS_IMETHOD Reflow(nsIPresContext&      aPresContext,
                    nsHTMLReflowMetrics& aDesiredSize,
                    const nsHTMLReflowState& aReflowState,
                    nsReflowStatus&      aStatus);
  virtual ~nsFormFrame();

  NS_IMETHOD QueryInterface(REFNSIID aIID, void** aInstancePtr);

  // nsIFormManager

  NS_IMETHOD OnReset();

  NS_IMETHOD OnSubmit(nsIPresContext* aPresContext, nsIFrame* aFrame);

  // other methods 

  void OnRadioChecked(nsRadioControlFrame& aRadio); 
    
  void AddFormControlFrame(nsIFormControlFrame& aFrame);
  static void AddFormControlFrame(nsIPresContext& aPresContext, nsIFrame& aFrame);

  PRBool CanSubmit(nsFormControlFrame& aFrame);

  NS_IMETHOD GetMethod(PRInt32* aMethod);
  NS_IMETHOD GetEnctype(PRInt32* aEnctype);
  NS_IMETHOD GetTarget(nsString* aTarget);
  NS_IMETHOD GetAction(nsString* aAction);

  static nsFormFrame* GetFormFrame(nsIPresContext& aPresContext, nsIDOMHTMLFormElement& aFormElem) { 
    return gFormFrameTable->Get(aPresContext, aFormElem);
  }

  static void PutFormFrame(nsIPresContext& aPresContext, nsIDOMHTMLFormElement& aFormElem, 
                           nsFormFrame& aFrame) { 
    gFormFrameTable->Put(aPresContext, aFormElem, aFrame);
  }

  // static helper functions for nsIFormControls
  
  static PRBool GetDisabled(nsIFrame* aChildFrame, nsIContent* aContent = 0);
  static PRBool GetReadonly(nsIFrame* aChildFrame, nsIContent* aContent = 0);

protected:
  NS_IMETHOD_(nsrefcnt) AddRef(void);
  NS_IMETHOD_(nsrefcnt) Release(void);
  virtual void GetDesiredSize(nsIPresContext* aPresContext,
                              const nsHTMLReflowState& aReflowState,
                              nsHTMLReflowMetrics& aDesiredSize);
  void RemoveRadioGroups();
  void ProcessAsURLEncoded(PRBool aIsPost, nsString& aData, nsIFormControlFrame* aFrame);
  void ProcessAsMultipart(nsString& aData, nsIFormControlFrame* aFrame);
  static const char* GetFileNameWithinPath(char* aPathName);

  // the following are temporary until nspr and/or netlib provide them
  static       Temp_GetTempDir(char* aTempDirName);
  static char* Temp_GenerateTempFileName(PRInt32 aMaxSize, char* aBuffer);
  static void  Temp_GetContentType(char* aPathName, char* aContentType);

  static nsFormFrameTable* gFormFrameTable;

  nsVoidArray          mFormControls;
  nsVoidArray          mRadioGroups;
  nsIFormControlFrame* mTextSubmitter;
};

#endif // nsFormFrame_h___
