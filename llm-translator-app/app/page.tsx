"use client";
import { Translate } from "@carbon/icons-react";
import { Button, Column, Grid, TextArea } from "@carbon/react";
import { ChangeEvent, useState } from "react";

interface TranslationResponse {
  translated: string;
}

export default function Home() {
  const [sourceText, setSourceText] = useState<string>("");
  const [targetText, setTargetText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>();

  const doTranslate = () => {
    setIsLoading(true);
    setError(undefined);
    return fetch(`/api/translate/de-en`, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: sourceText }),
    })
      .then((response) => {
        return response.json();
      })
      .then((translationResponse: TranslationResponse) => {
        setIsLoading(false);
        setTargetText(translationResponse.translated);
      })
      .catch((err) => {
        console.error("failed to translate", err);
        setIsLoading(false);
        setError(`Failed to translate. Error: '${err.message}'`);
      });
  };

  const updateSourceText = (evt: ChangeEvent<HTMLTextAreaElement>) => {
    setError(undefined);
    if (evt?.target?.value != null) {
      setSourceText(evt?.target?.value);
    }
  };

  return (
    <main className="main-content">
      <Grid>
        <Column sm={4} md={3} lg={6}>
          <TextArea
            labelText={`Source language: de`}
            placeholder="Type to translate"
            rows={5}
            id="translation-source"
            value={sourceText}
            onChange={updateSourceText}
          />
        </Column>
        <Column sm={4} md={2} lg={4} className="cta-btns">
          <Button
            onClick={doTranslate}
            disabled={isLoading || !sourceText}
            renderIcon={Translate}
            id="cta-translate"
            className="cta-btn"
          >
            Translate
          </Button>
        </Column>
        <Column sm={4} md={3} lg={6}>
          <TextArea
            labelText={`Target language: en`}
            rows={5}
            id="translation-target"
            value={targetText}
            disabled={isLoading}
            invalid={!!error}
            invalidText={error}
          />
        </Column>
      </Grid>
    </main>
  );
}
